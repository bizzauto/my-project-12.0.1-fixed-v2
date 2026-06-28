import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, CheckCircle, Circle, Lock, Loader2,
  MessageCircle, Send, ChevronDown, ChevronRight, BookOpen,
  Clock, BarChart3, Award, Maximize2, Volume2, Menu
} from 'lucide-react';
import { coursesAPI } from '../lib/api';

interface Lesson {
  id: string;
  title: string;
  description?: string;
  type: string;
  content?: any;
  duration?: number;
  order: number;
  isFree: boolean;
  isPublished: boolean;
}

interface Module {
  id: string;
  name: string;
  description?: string;
  order: number;
  lessons: Lesson[];
}

interface Enrollment {
  id: string;
  status: string;
  progress: number;
  enrolledAt: string;
  lastAccessedAt?: string;
  completedAt?: string;
}

interface Course {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  business?: { name: string; logoUrl?: string };
  modules: Module[];
  isEnrolled?: boolean;
  enrollment?: Enrollment | null;
}

interface DoubtMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export default function CoursePlayer() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState(0);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [doubtMessages, setDoubtMessages] = useState<DoubtMessage[]>([]);
  const [doubtInput, setDoubtInput] = useState('');
  const [solvingDoubt, setSolvingDoubt] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!courseId) return;
    loadCourse();
  }, [courseId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [doubtMessages]);

  const loadCourse = async () => {
    try {
      setLoading(true);
      const res = await coursesAPI.getStudentView(courseId!);
      if (res.data.success) {
        const data = res.data.data;
        setCourse(data);
        if (data.enrollment) {
          setProgress(data.enrollment.progress);
          setEnrollmentId(data.enrollment.id);
        }
        // Set first lesson as current
        if (data.modules?.[0]?.lessons?.[0]) {
          setCurrentLesson(data.modules[0].lessons[0]);
          setExpandedModules(new Set([data.modules[0].id]));
        }
      } else {
        setError(res.data.error || 'Failed to load course');
      }
    } catch {
      setError('Network error loading course');
    } finally {
      setLoading(false);
    }
  };

  const handleLessonClick = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    if (enrollmentId && course) {
      // Update last accessed
      coursesAPI.updateProgress(enrollmentId, { progress }).catch(() => {});
    }
  };

  const handleVideoProgress = () => {
    if (!videoRef.current || !enrollmentId) return;
    const pct = Math.round((videoRef.current.currentTime / (videoRef.current.duration || 1)) * 100);
    setVideoProgress(pct);
    const overallProgress = Math.min(100, Math.max(progress, pct));
    setProgress(overallProgress);
    coursesAPI.updateProgress(enrollmentId, { progress: overallProgress }).catch(() => {});
  };

  const handleCompleteLesson = async () => {
    if (!enrollmentId) return;
    const newProgress = Math.min(100, progress + Math.round(100 / getTotalLessons()));
    setProgress(newProgress);
    await coursesAPI.updateProgress(enrollmentId, { progress: newProgress }).catch(() => {});
  };

  const handleDoubtSubmit = async () => {
    if (!doubtInput.trim() || !courseId) return;
    const userMsg: DoubtMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: doubtInput.trim(),
      timestamp: new Date(),
    };
    setDoubtMessages(prev => [...prev, userMsg]);
    setDoubtInput('');
    setSolvingDoubt(true);

    try {
      const res = await coursesAPI.solveDoubt(courseId, {
        question: userMsg.content,
        lessonTitle: currentLesson?.title,
        moduleTitle: getModuleForLesson(currentLesson?.id || '')?.name,
      });
      if (res.data.success) {
        const aiMsg: DoubtMessage = {
          id: `ai-${Date.now()}`,
          role: 'ai',
          content: res.data.data.answer,
          timestamp: new Date(),
        };
        setDoubtMessages(prev => [...prev, aiMsg]);
      }
    } catch {
      const errMsg: DoubtMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'ai',
        content: "I'm having trouble answering right now. Please try again or contact your instructor.",
        timestamp: new Date(),
      };
      setDoubtMessages(prev => [...prev, errMsg]);
    } finally {
      setSolvingDoubt(false);
    }
  };

  const getModuleForLesson = (lessonId: string) => {
    return course?.modules.find(m => m.lessons.some(l => l.id === lessonId));
  };

  const getTotalLessons = () => {
    return course?.modules.reduce((sum, m) => sum + m.lessons.length, 0) || 1;
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const isLessonCurrent = (lesson: Lesson) => currentLesson?.id === lesson.id;

  const getVideoUrl = () => {
    return currentLesson?.content?.videoUrl || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <BookOpen size={48} className="mx-auto text-gray-500 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Course not found</h2>
          <p className="text-gray-400 mb-4">{error || 'This course is not available'}</p>
          <button onClick={() => navigate('/my-learning')} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Go to My Courses</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top Bar */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/my-learning')} className="p-2 hover:bg-gray-700 rounded-lg text-gray-300">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-white truncate max-w-md">{course.name}</h1>
            <p className="text-xs text-gray-400">{course.business?.name || 'Course'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-blue-600/20 rounded-full text-xs text-blue-400 font-medium">
            {progress}% Complete
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-700 rounded-lg text-gray-300 lg:hidden">
            <Menu size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Curriculum */}
        <div className={`bg-gray-800 border-r border-gray-700 overflow-y-auto transition-all duration-300 ${
          sidebarOpen ? 'w-80' : 'w-0 lg:w-0'
        } hidden lg:block`}>
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Course Content</h3>
            
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {course.modules.map((module) => (
              <div key={module.id} className="mb-2">
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-700/50 text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {expandedModules.has(module.id) ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
                    <span className="text-sm text-gray-200 truncate">{module.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">{module.lessons.length} lessons</span>
                </button>
                
                {expandedModules.has(module.id) && (
                  <div className="ml-4 space-y-0.5 mt-0.5">
                    {module.lessons.map((lesson) => (
                      <button
                        key={lesson.id}
                        onClick={() => handleLessonClick(lesson)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                          isLessonCurrent(lesson)
                            ? 'bg-blue-600/20 text-blue-400'
                            : 'text-gray-400 hover:bg-gray-700/30 hover:text-gray-200'
                        }`}
                      >
                        {lesson.type === 'video' ? (
                          isLessonCurrent(lesson) ? <Play size={14} className="flex-shrink-0" /> : <Circle size={14} className="flex-shrink-0" />
                        ) : (
                          <BookOpen size={14} className="flex-shrink-0" />
                        )}
                        <span className="text-xs truncate">{lesson.title}</span>
                        {lesson.duration && (
                          <span className="text-[10px] text-gray-500 ml-auto flex-shrink-0">{Math.floor(lesson.duration / 60)}m</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-gray-800 overflow-y-auto p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Course Content</h3>
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
              {course.modules.map((module) => (
                <div key={module.id} className="mb-2">
                  <button onClick={() => toggleModule(module.id)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-700/50 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      {expandedModules.has(module.id) ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                      <span className="text-sm text-gray-200 truncate">{module.name}</span>
                    </div>
                  </button>
                  {expandedModules.has(module.id) && module.lessons.map((lesson) => (
                    <button key={lesson.id} onClick={() => { handleLessonClick(lesson); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ml-4 ${isLessonCurrent(lesson) ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700/30'}`}>
                      <Play size={14} />
                      <span className="text-xs truncate">{lesson.title}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Video / Content Area */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            {currentLesson ? (
              <>
                {/* Video Player */}
                {currentLesson.type === 'video' && getVideoUrl() && (
                  <div className="bg-black relative">
                    <video
                      ref={videoRef}
                      src={getVideoUrl()}
                      controls
                      className="w-full max-h-[60vh] object-contain"
                      onTimeUpdate={handleVideoProgress}
                      poster={course.thumbnail}
                    />
                  </div>
                )}
                
                {/* Text Content */}
                {currentLesson.type === 'text' && currentLesson.content?.text && (
                  <div className="p-6">
                    <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: currentLesson.content.text }} />
                  </div>
                )}

                {/* Lesson Info */}
                <div className="p-6">
                  <h2 className="text-xl font-bold text-white mb-2">{currentLesson.title}</h2>
                  {currentLesson.description && (
                    <p className="text-gray-400 text-sm mb-4">{currentLesson.description}</p>
                  )}
                  
                  {/* Complete Button */}
                  <button
                    onClick={handleCompleteLesson}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    <CheckCircle size={18} />
                    Mark as Complete
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-8">
                  <BookOpen size={48} className="mx-auto text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-300 mb-2">Select a Lesson</h3>
                  <p className="text-gray-500">Choose a lesson from the course content sidebar to start learning</p>
                </div>
              </div>
            )}
          </div>

          {/* AI Doubt Solver Panel */}
          <div className="w-full lg:w-80 bg-gray-800 border-t lg:border-t-0 lg:border-l border-gray-700 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
              <MessageCircle size={16} className="text-purple-400" />
              <h3 className="text-sm font-semibold text-white">AI Doubt Solver</h3>
              <span className="text-[10px] px-1.5 py-0.5 bg-purple-600/20 text-purple-400 rounded-full">Gemini</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {doubtMessages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle size={32} className="mx-auto text-gray-600 mb-2" />
                  <p className="text-xs text-gray-500">Ask any question about this lesson</p>
                  <p className="text-xs text-gray-600 mt-1">The AI will answer with course context</p>
                </div>
              )}
              {doubtMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-200'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-[10px] mt-1 opacity-60">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {solvingDoubt && (
                <div className="flex justify-start">
                  <div className="bg-gray-700 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-purple-400" />
                      <span className="text-sm text-gray-400">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={doubtInput}
                  onChange={(e) => setDoubtInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDoubtSubmit()}
                  placeholder="Ask a doubt..."
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleDoubtSubmit}
                  disabled={solvingDoubt || !doubtInput.trim()}
                  className="p-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
