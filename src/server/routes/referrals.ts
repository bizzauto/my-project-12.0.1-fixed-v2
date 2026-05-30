import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticate, requireBusinessOwner } from '../middleware/auth.js';

const router = Router();

function generateReferralCode(businessId: string): string {
  const prefix = businessId.slice(0, 4).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

// Get referral program config
router.get('/program', authenticate, async (req: any, res: any) => {
  try {
    const program = await prisma.referralProgram.findUnique({
      where: { businessId: req.user.businessId },
    });

    res.json({ success: true, data: program || null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch referral program', details: error.message });
  }
});

// Create or update referral program
router.post('/program', authenticate, requireBusinessOwner, async (req: any, res: any) => {
  try {
    const { referrerReward, refereeReward, rewardType, maxReferrals, isActive } = req.body;

    if (referrerReward == null || refereeReward == null) {
      return res.status(400).json({ success: false, error: 'referrerReward and refereeReward are required' });
    }

    if (rewardType && !['credits', 'discount', 'cash'].includes(rewardType)) {
      return res.status(400).json({ success: false, error: 'rewardType must be credits, discount, or cash' });
    }

    const program = await prisma.referralProgram.upsert({
      where: { businessId: req.user.businessId },
      create: {
        businessId: req.user.businessId,
        referrerReward,
        refereeReward,
        rewardType: rewardType || 'credits',
        maxReferrals: maxReferrals ?? null,
        isActive: isActive ?? true,
      },
      update: {
        referrerReward,
        refereeReward,
        rewardType: rewardType || 'credits',
        maxReferrals: maxReferrals ?? null,
        isActive: isActive ?? true,
      },
    });

    res.json({ success: true, data: program });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to save referral program', details: error.message });
  }
});

// Get current user's referrals
router.get('/my-referrals', authenticate, async (req: any, res: any) => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {
      businessId: req.user.businessId,
      referrerId: req.user.id,
    };

    if (status && ['pending', 'completed', 'rewarded'].includes(status as string)) {
      where.status = status;
    }

    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        include: {
          referee: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.referral.count({ where }),
    ]);

    res.json({
      success: true,
      data: referrals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch referrals', details: error.message });
  }
});

// Generate referral code for a contact
router.post('/generate-code', authenticate, async (req: any, res: any) => {
  try {
    const { contactId } = req.body;

    if (!contactId) {
      return res.status(400).json({ success: false, error: 'contactId is required' });
    }

    const program = await prisma.referralProgram.findUnique({
      where: { businessId: req.user.businessId },
    });

    if (!program || !program.isActive) {
      return res.status(400).json({ success: false, error: 'No active referral program for this business' });
    }

    if (program.maxReferrals) {
      const existingCount = await prisma.referral.count({
        where: { businessId: req.user.businessId, referrerId: req.user.id },
      });
      if (existingCount >= program.maxReferrals) {
        return res.status(400).json({ success: false, error: 'Maximum referral limit reached' });
      }
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, businessId: req.user.businessId },
    });

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const existing = await prisma.referral.findFirst({
      where: {
        businessId: req.user.businessId,
        referrerId: req.user.id,
        refereeId: contactId,
      },
    });

    if (existing) {
      return res.json({ success: true, data: existing, message: 'Referral code already exists for this contact' });
    }

    let code: string;
    let attempts = 0;
    do {
      code = generateReferralCode(req.user.businessId);
      attempts++;
    } while (attempts < 10);

    const referral = await prisma.referral.create({
      data: {
        businessId: req.user.businessId,
        referrerId: req.user.id,
        refereeId: contactId,
        referralCode: code,
        referrerReward: program.referrerReward,
        refereeReward: program.refereeReward,
      },
    });

    res.json({ success: true, data: referral });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to generate referral code', details: error.message });
  }
});

// Apply referral code (referee uses code)
router.post('/apply', authenticate, async (req: any, res: any) => {
  try {
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({ success: false, error: 'referralCode is required' });
    }

    const referral = await prisma.referral.findUnique({
      where: { referralCode },
      include: {
        referrer: { select: { id: true, name: true, businessId: true } },
      },
    });

    if (!referral) {
      return res.status(404).json({ success: false, error: 'Invalid referral code' });
    }

    if (referral.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'This referral code has already been used' });
    }

    if (referral.referrerId === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot use your own referral code' });
    }

    const program = await prisma.referralProgram.findUnique({
      where: { businessId: referral.businessId },
    });

    if (!program || !program.isActive) {
      return res.status(400).json({ success: false, error: 'Referral program is not active' });
    }

    const updated = await prisma.referral.update({
      where: { id: referral.id },
      data: {
        refereeId: req.user.id,
        status: 'completed',
        completedAt: new Date(),
      },
    });

    res.json({ success: true, data: updated, message: 'Referral code applied successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to apply referral code', details: error.message });
  }
});

// Reward referrer after referee's first purchase
router.post('/:id/reward', authenticate, requireBusinessOwner, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const referral = await prisma.referral.findFirst({
      where: { id, businessId: req.user.businessId },
    });

    if (!referral) {
      return res.status(404).json({ success: false, error: 'Referral not found' });
    }

    if (referral.status === 'rewarded') {
      return res.status(400).json({ success: false, error: 'Reward has already been granted' });
    }

    if (referral.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Referral has not been completed yet' });
    }

    const program = await prisma.referralProgram.findUnique({
      where: { businessId: req.user.businessId },
    });

    if (!program) {
      return res.status(400).json({ success: false, error: 'No referral program found' });
    }

    const updated = await prisma.referral.update({
      where: { id },
      data: { status: 'rewarded' },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        businessId: req.user.businessId,
        type: 'referral_reward',
        title: 'Referral reward granted',
        content: `Referrer reward: ${referral.referrerReward} ${program.rewardType}, Referee reward: ${referral.refereeReward} ${program.rewardType}`,
        metadata: {
          referralId: referral.id,
          referrerId: referral.referrerId,
          refereeId: referral.refereeId,
          referrerReward: referral.referrerReward,
          refereeReward: referral.refereeReward,
          rewardType: program.rewardType,
        },
        createdBy: req.user.id,
      },
    });

    res.json({ success: true, data: updated, message: 'Rewards granted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to grant rewards', details: error.message });
  }
});

// Referral stats
router.get('/stats', authenticate, async (req: any, res: any) => {
  try {
    const businessId = req.user.businessId;

    const [totalReferrals, pendingReferrals, completedReferrals, rewardedReferrals, referralsByMonth] = await Promise.all([
      prisma.referral.count({ where: { businessId } }),
      prisma.referral.count({ where: { businessId, status: 'pending' } }),
      prisma.referral.count({ where: { businessId, status: 'completed' } }),
      prisma.referral.count({ where: { businessId, status: 'rewarded' } }),
      prisma.referral.groupBy({
        by: ['createdAt'],
        where: { businessId },
        _count: true,
      }),
    ]);

    const monthlyMap = new Map<string, number>();
    for (const entry of referralsByMonth) {
      const month = (entry.createdAt as Date).toISOString().slice(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + entry._count);
    }
    const referralsByMonthAggregated = Array.from(monthlyMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    const conversionRate = totalReferrals > 0
      ? ((completedReferrals + rewardedReferrals) / totalReferrals) * 100
      : 0;

    const program = await prisma.referralProgram.findUnique({
      where: { businessId },
    });

    const totalRewardsGiven = rewardedReferrals * (program?.referrerReward || 0);

    res.json({
      success: true,
      data: {
        totalReferrals,
        pendingReferrals,
        completedReferrals,
        rewardedReferrals,
        conversionRate: Math.round(conversionRate * 100) / 100,
        totalRewardsGiven,
        referralsByMonth: referralsByMonthAggregated,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch referral stats', details: error.message });
  }
});

// Leaderboard - top referrers
router.get('/leaderboard', authenticate, async (req: any, res: any) => {
  try {
    const { limit = '10', period } = req.query;
    const businessId = req.user.businessId;

    const where: any = {
      businessId,
      status: { in: ['completed', 'rewarded'] },
    };

    if (period) {
      const now = new Date();
      if (period === 'week') {
        where.createdAt = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      } else if (period === 'month') {
        where.createdAt = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
      } else if (period === 'year') {
        where.createdAt = { gte: new Date(now.getFullYear(), 0, 1) };
      }
    }

    const referrals = await prisma.referral.groupBy({
      by: ['referrerId'],
      where,
      _count: true,
      _sum: { referrerReward: true },
      orderBy: { _count: { referrerId: 'desc' } },
      take: parseInt(limit),
    });

    const referrerIds = referrals.map((r) => r.referrerId);
    const contacts = await prisma.contact.findMany({
      where: { id: { in: referrerIds }, businessId },
      select: { id: true, name: true, phone: true, email: true },
    });

    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    const leaderboard = referrals.map((entry, index) => ({
      rank: index + 1,
      referrer: contactMap.get(entry.referrerId) || { id: entry.referrerId, name: 'Unknown' },
      totalReferrals: entry._count,
      totalRewards: entry._sum.referrerReward || 0,
    }));

    res.json({ success: true, data: leaderboard });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard', details: error.message });
  }
});

export default router;
