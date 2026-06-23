import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { razorpay } from './razorpay.service.js';
import { prisma } from '../db.js';

interface UpiPaymentRequest {
  phone: string;
  amount: number;
  description: string;
  orderId?: string;
  customerName?: string;
}

interface UpiPaymentResponse {
  success: boolean;
  transactionId?: string;
  amount?: number;
  status: 'pending' | 'completed' | 'failed';
  message?: string;
  upiLink?: string;
  qrCode?: string;
}

const UPI_VPA = process.env.UPI_VPA || 'bizzauto@upi';
const UPI_MERCHANT_NAME = 'BizzAuto CRM';

export class WhatsAppPaymentService {
  
  // Create UPI payment link for WhatsApp
  async createUpiPayment(data: UpiPaymentRequest): Promise<UpiPaymentResponse> {
    try {
      const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Create UPI deep link
      const upiLink = this.generateUpiLink({
        vpa: UPI_VPA,
        amount: data.amount.toString(),
        transactionId,
        note: data.description.substring(0, 50),
        name: data.customerName || UPI_MERCHANT_NAME,
      });

      // Generate QR code for payment
      const qrCode = await this.generateQrCode(upiLink);

      return {
        success: true,
        transactionId,
        amount: data.amount,
        status: 'pending',
        upiLink,
        qrCode,
        message: `Payment link created for ₹${data.amount}`,
      };
    } catch (error) {
      console.error('UPI Payment error:', error);
      return {
        success: false,
        status: 'failed',
        message: 'Failed to create payment link',
      };
    }
  }

  // Generate UPI deep link
  private generateUpiLink(params: { vpa: string; amount: string; transactionId: string; note: string; name: string }): string {
    const { vpa, amount, transactionId, note, name } = params;
    
    // UPI deep link format
    const upiLink = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${transactionId}`;
    
    // Also create a web payment URL as fallback
    const webUrl = `https://pay.google.com/pay/v1/widget/sandbox/pay?pa=${vpa}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
    
    return upiLink;
  }

  // Generate QR code
  private async generateQrCode(data: string): Promise<string> {
    // Using QR Server API (free, no key required)
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`;
  }

  // Verify payment status by checking DB + Razorpay API
  async verifyPayment(transactionId: string): Promise<{ verified: boolean; status: string }> {
    try {
      // 1. Look up transaction in DB by ID
      let transaction = await prisma.paymentLinkTransaction.findUnique({
        where: { id: transactionId },
      });

      // 2. If not found by ID, try as razorpayPaymentId
      if (!transaction) {
        transaction = await prisma.paymentLinkTransaction.findFirst({
          where: { razorpayPaymentId: transactionId },
        });
      }

      if (transaction) {
        // Already captured/confirmed in DB
        if (transaction.status === 'captured' || transaction.status === 'completed') {
          return { verified: true, status: 'completed' };
        }

        if (transaction.status === 'failed') {
          return { verified: false, status: 'failed' };
        }

        // Pending with Razorpay payment ID — verify live with Razorpay API
        if (transaction.razorpayPaymentId && razorpay) {
          try {
            const payment = await (razorpay.payments.fetch as any)(transaction.razorpayPaymentId);
            if (payment && payment.status === 'captured') {
              // Update DB to reflect captured status
              await prisma.paymentLinkTransaction.update({
                where: { id: transaction.id },
                data: { status: 'captured' },
              });
              return { verified: true, status: 'captured' };
            }
            return { verified: false, status: payment?.status || 'pending' };
          } catch (razorpayErr) {
            console.warn('[WhatsAppPayment] Razorpay fetch failed:', razorpayErr);
            return { verified: false, status: transaction.status };
          }
        }

        // UPI or non-Razorpay — can't auto-verify, return DB status
        return { verified: false, status: transaction.status };
      }

      // 3. Not found in our DB — try direct Razorpay payment lookup
      if (razorpay) {
        try {
          const payment = await (razorpay.payments.fetch as any)(transactionId);
          if (payment && payment.status === 'captured') {
            return { verified: true, status: 'captured' };
          }
          return { verified: false, status: payment?.status || 'unknown' };
        } catch {
          // Not a valid Razorpay payment ID either
        }
      }

      return { verified: false, status: 'not_found' };
    } catch (error) {
      console.error('[WhatsAppPayment] verifyPayment error:', error);
      return { verified: false, status: 'error' };
    }
  }

  // Send payment link via WhatsApp
  async sendPaymentLink(phone: string, amount: number, description: string, customerName?: string): Promise<{ success: boolean; messageId?: string }> {
    const paymentData: UpiPaymentRequest = {
      phone,
      amount,
      description,
      customerName,
    };

    const payment = await this.createUpiPayment(paymentData);

    if (!payment.success) {
      return { success: false };
    }

    // Create WhatsApp message with payment link
    const message = `💰 *Payment Request*\n\n` +
      `*Dear ${customerName || 'Customer'}*,\n\n` +
      `Amount: *₹${amount}*\n` +
      `Description: ${description}\n\n` +
      `Click to pay: ${payment.upiLink}\n\n` +
      `Or scan QR code: ${payment.qrCode}\n\n` +
      `Transaction ID: ${payment.transactionId}\n\n` +
      `Powered by BizzAuto CRM`;

    return {
      success: true,
      messageId: payment.transactionId,
    };
  }

  // Create Razorpay Order for larger payments
  async createRazorpayOrder(amount: number, currency: string = 'INR', receipt: string): Promise<{ id: string; amount: number; currency: string } | null> {
    if (!razorpay) {
      console.log('Razorpay not configured');
      return null;
    }

    try {

      const order = await (razorpay.orders.create as any)({
        amount: amount * 100, // Convert to paise
        currency,
        receipt,
        payment_capture: 1,
      });

      return {
        id: order.id,
        amount: order.amount / 100,
        currency: order.currency,
      };
    } catch (error) {
      console.error('Razorpay order creation error:', error);
      return null;
    }
  }
}

export const whatsappPaymentService = new WhatsAppPaymentService();

// Express route handlers
export const createPaymentLink = async (req: Request, res: Response) => {
  const { phone, amount, description, customerName } = req.body;

  if (!phone || !amount || !description) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: phone, amount, description',
    });
  }

  const payment = await whatsappPaymentService.sendPaymentLink(phone, amount, description, customerName);

  res.json({
    success: payment.success,
    message: payment.success ? 'Payment link sent' : 'Failed to create payment link',
  });
};

export const verifyPayment = async (req: Request, res: Response) => {
  const { transactionId } = req.body;

  const result = await whatsappPaymentService.verifyPayment(transactionId);

  res.json({
    success: result.verified,
    status: result.status,
  });
};