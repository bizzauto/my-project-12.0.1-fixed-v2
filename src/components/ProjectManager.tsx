import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, X, Send, Mic, MicOff, Volume2, VolumeX,
  Home, Users, Star, MessageSquare, ShoppingCart, 
  BarChart3, Settings, Zap, Mail, Calendar,
  UserPlus, FileText, Palette, Clock, CreditCard,
  GraduationCap, Workflow, Link, Globe, Shield
} from 'lucide-react';

// Feature quick actions for Project Manager
const FEATURE_ACTIONS = [
  { id: '/dashboard', label: 'Dashboard', icon: <Home size={18} />, color: 'blue' },
  { id: '/leads', label: 'Leads', icon: <UserPlus size={18} />, color: 'green' },
  { id: '/whatsapp', label: 'WhatsApp', icon: <MessageSquare size={18} />, color: 'emerald' },
  { id: '/reviews', label: 'Reviews', icon: <Star size={18} />, color: 'yellow' },
  { id: '/appointments', label: 'Appointments', icon: <Calendar size={18} />, color: 'purple' },
  { id: '/email-marketing', label: 'Email', icon: <Mail size={18} />, color: 'red' },
  { id: '/campaigns', label: 'Campaigns', icon: <Zap size={18} />, color: 'orange' },
  { id: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} />, color: 'indigo' },
  { id: '/ecommerce', label: 'Store', icon: <ShoppingCart size={18} />, color: 'pink' },
  { id: '/documents', label: 'Docs', icon: <FileText size={18} />, color: 'gray' },
  { id: '/social', label: 'Social', icon: <Globe size={18} />, color: 'sky' },
  { id: '/automation', label: 'Auto', icon: <Zap size={18} />, color: 'violet' },
  { id: '/courses', label: 'Courses', icon: <GraduationCap size={18} />, color: 'teal' },
  { id: '/workflows', label: 'Workflows', icon: <Workflow size={18} />, color: 'cyan' },
  { id: '/settings', label: 'Settings', icon: <Settings size={18} />, color: 'slate' },
  { id: '/billing', label: 'Billing', icon: <CreditCard size={18} />, color: 'amber' },
];

const colorMap: Record<string, string> = {
  blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
  green: 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700',
  emerald: 'from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700',
  yellow: 'from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700',
  purple: 'from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700',
  red: 'from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700',
  orange: 'from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700',
  indigo: 'from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700',
  pink: 'from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700',
  gray: 'from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700',
  sky: 'from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700',
  violet: 'from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700',
  teal: 'from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700',
  cyan: 'from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700',
  slate: 'from-slate-500 to-gray-600 hover:from-slate-600 hover:to-gray-700',
  amber: 'from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700',
};

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  isAction?: boolean;
}

const ProjectManager: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      text: 'Namaste! Main PM hoon — aapka Project Manager! 🚀\n\nKya karna chahenge? Jaise:\n• "Leads dikhao" → Leads page kholunga\n• "Reviews" → Reviews page kholunga\n• "Dashboard" → Dashboard kholunga\n\nYa neeche diye gaye buttons mein se koi dabao!',
      isUser: false,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (text: string, isUser: boolean, isAction?: boolean) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), text, isUser, isAction }]);
  };

  const handleQuickAction = (featureId: string, label: string) => {
    addMessage(`📂 ${label} kholo`, true, true);
    addMessage(`✅ ${label} page khol raha hun!`, false, true);
    setTimeout(() => navigate(featureId), 500);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const userText = inputText.trim();
    setInputText('');
    addMessage(userText, true);

    // Check for feature keywords and navigate
    const cmds: [RegExp, string, string][] = [
      [/लीड्स?|lead|prospect|customer/gi, '/leads', 'Leads'],
      [/रिव्यू|समीक्षा|review|rating/gi, '/reviews', 'Reviews'],
      [/डैशबोर्ड|dashboard|home/gi, '/dashboard', 'Dashboard'],
      [/व्हाट्सएप|whatsapp|message/gi, '/whatsapp', 'WhatsApp'],
      [/कैम्पेन|campaign|promotion/gi, '/campaigns', 'Campaigns'],
      [/बुकिंग|appointment|schedule|calendar/gi, '/appointments', 'Appointments'],
      [/ईमेल|email|mail/gi, '/email-marketing', 'Email Marketing'],
      [/सोशल|social|facebook|instagram/gi, '/social', 'Social Media'],
      [/एनालिटिक्स|analytics|insight|data/gi, '/analytics', 'Analytics'],
      [/सेटिंग्स|settings/gi, '/settings', 'Settings'],
      [/डॉक्यूमेंट|document|file|invoice/gi, '/documents', 'Documents'],
      [/क्रिएटिव|creative|poster|design/gi, '/creative', 'Creative'],
      [/ईकॉमर्स|ecommerce|store|shop/gi, '/ecommerce', 'E-Commerce'],
      [/ऑटोमेशन|automation|workflow/gi, '/automation', 'Automation'],
      [/बिलिंग|billing|payment|subscription/gi, '/billing', 'Billing'],
      [/कोर्स|courses?|training/gi, '/courses', 'Courses'],
      [/सर्वे|survey|poll/gi, '/surveys', 'Surveys'],
      [/रिपोर्ट|report/gi, '/reports', 'Reports'],
      [/फनल|funnel|landing/gi, '/funnels', 'Funnels'],
      [/टीम|team|member/gi, '/team', 'Team Management'],
      [/प्रोफाइल|profile/gi, '/profile', 'Profile'],
      [/गूगल|google business|post/gi, '/google-business', 'Google Business'],
      [/कन्वर्सेशन|conversation|chat/gi, '/conversations', 'Conversations'],
    ];

    for (const [regex, path, label] of cmds) {
      if (regex.test(userText)) {
        addMessage(`✅ ${label} page khol raha hun!`, false, true);
        setTimeout(() => navigate(path), 500);
        return;
      }
    }

    // If no feature matched, give helpful suggestions
    const hi = /[ऀ-ॿ]/.test(userText);
    if (hi) {
      addMessage('Sir, main ye features handle kar sakta hun: Leads, Dashboard, WhatsApp, Reviews, Campaigns, Appointments, aur bhi bahut kuch. Kya dekhna chahenge?', false);
    } else {
      addMessage('Sir, I can handle: Leads, Dashboard, WhatsApp, Reviews, Campaigns, Appointments, and many more. What would you like to see?', false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-20 right-20 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-indigo-500 hover:bg-indigo-600'
            : 'bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 animate-pulse'
        }`}
      >
        {isOpen ? <X size={24} className="text-white" /> : <Bot size={24} className="text-white" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-38 right-20 z-50 w-[380px] max-w-[calc(100vw-48px)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col" style={{ height: '550px', maxHeight: 'calc(100vh - 150px)' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    🚀 Project Manager
                    <Shield size={14} className="text-green-300" />
                  </h3>
                  <p className="text-white/80 text-xs">BizzAuto CRM Controller</p>
                </div>
              </div>
              <button onClick={() => setIsMuted(!isMuted)} className="p-2 rounded-full hover:bg-white/20">
                {isMuted ? <VolumeX size={16} className="text-white" /> : <Volume2 size={16} className="text-white" />}
              </button>
            </div>
          </div>

          {/* Feature Quick Actions Grid */}
          <div className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/30">
            <div className="flex flex-wrap gap-1.5">
              {FEATURE_ACTIONS.slice(0, 8).map(f => (
                <button
                  key={f.id}
                  onClick={() => handleQuickAction(f.id, f.label)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r ${colorMap[f.color]} shadow-sm transition-all hover:shadow-md active:scale-95`}
                >
                  {f.icon}
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {FEATURE_ACTIONS.slice(8).map(f => (
                <button
                  key={f.id}
                  onClick={() => handleQuickAction(f.id, f.label)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r ${colorMap[f.color]} shadow-sm transition-all hover:shadow-md active:scale-95`}
                >
                  {f.icon}
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'} animate-fade-in ${msg.isAction ? 'opacity-80' : ''}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    msg.isUser
                      ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-br-md'
                      : msg.isAction
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-bl-md border border-green-200 dark:border-green-800/30'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!msg.isUser && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 flex items-center justify-center shrink-0">
                        <Bot size={14} className="text-white" />
                      </div>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    {msg.isUser && (
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs">👤</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsListening(!isListening)}
                className={`p-3 rounded-full transition-all ${
                  isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a feature name or command..."
                className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className="p-3 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectManager;
