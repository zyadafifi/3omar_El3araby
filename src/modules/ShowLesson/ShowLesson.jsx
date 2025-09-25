import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import PropTypes from "prop-types";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  BookOpen,
  Trash2,
  Globe2,
  Loader2,
  Turtle,
} from "lucide-react";
import { IoIosSend, IoIosMic } from "react-icons/io";
import { Link, useParams } from "react-router-dom";
import { levelsAndLesson } from "../../config/levelsAndLesson/levelsAndLesson";
import { PiExam } from "react-icons/pi";

/* ========================== TTS Support & Voice Pref ========================== */
const supportsTTS =
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  "SpeechSynthesisUtterance" in window;

const PREFERRED_VOICE_NAME = "Google UK English Female";
const PREFERRED_VOICE_LANG = "en-GB";

/* ========================== Android Detection & Compatibility ========================== */
const isAndroid = () => {
  return /Android/i.test(navigator.userAgent);
};

// Removed unused functions isChrome and isMobile

// Android-compatible MediaRecorder formats (in order of preference)
const ANDROID_AUDIO_FORMATS = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/wav",
];

// Get the best supported audio format for the current device
const getBestAudioFormat = () => {
  if (!window.MediaRecorder) return null;

  for (const format of ANDROID_AUDIO_FORMATS) {
    if (MediaRecorder.isTypeSupported(format)) {
      return format;
    }
  }
  return null;
};

// Android-specific audio context settings
const getAudioContextConfig = () => {
  if (isAndroid()) {
    return {
      sampleRate: 44100, // Standard sample rate for Android
      latencyHint: "interactive",
    };
  }
  return {};
};

/* ========================== AssemblyAI Integration ========================== */
const ASSEMBLYAI_API_KEY = "bdb00961a07c4184889a80206c52b6f2";
const ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2";

// AssemblyAI service functions
const assemblyAIService = {
  // Upload audio file to AssemblyAI
  async uploadAudio(audioBlob) {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch(`${ASSEMBLYAI_BASE_URL}/upload`, {
        method: "POST",
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.upload_url;
    } catch (error) {
      console.error("AssemblyAI upload error:", error);
      throw error;
    }
  },

  // Create transcription job
  async createTranscription(audioUrl) {
    try {
      const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
        method: "POST",
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          language_code: "en",
          punctuate: false,
          format_text: false,
          speech_model: "best", // Use best model for accuracy
        }),
      });

      if (!response.ok) {
        throw new Error(`Transcription request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error("AssemblyAI transcription error:", error);
      throw error;
    }
  },

  // Poll for transcription result
  async getTranscription(transcriptId) {
    try {
      const response = await fetch(
        `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`,
        {
          headers: {
            authorization: ASSEMBLYAI_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Get transcription failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("AssemblyAI get transcription error:", error);
      throw error;
    }
  },

  // Complete transcription process
  async transcribeAudio(audioBlob, onProgress = null) {
    try {
      if (onProgress) onProgress("جاري رفع التسجيل...");

      // Upload audio
      const audioUrl = await this.uploadAudio(audioBlob);

      if (onProgress) onProgress("جاري معالجة التسجيل...");

      // Create transcription
      const transcriptId = await this.createTranscription(audioUrl);

      // Poll for result
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      while (attempts < maxAttempts) {
        const result = await this.getTranscription(transcriptId);

        if (result.status === "completed") {
          return {
            text: result.text || "",
            confidence: result.confidence || 0.8,
          };
        } else if (result.status === "error") {
          throw new Error(`Transcription failed: ${result.error}`);
        }

        // Wait 1 second before next poll
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;

        if (onProgress) {
          onProgress(`جاري المعالجة... (${attempts}/${maxAttempts})`);
        }
      }

      throw new Error("Transcription timeout");
    } catch (error) {
      console.error("AssemblyAI transcription process error:", error);
      throw error;
    }
  },
};

/* ========================== Enhanced Pronunciation System ========================== */

// قاموس الاختصارات الشائعة
const CONTRACTIONS_MAP = {
  "i'm": "i am",
  "you're": "you are",
  "he's": "he is",
  "she's": "she is",
  "it's": "it is",
  "we're": "we are",
  "they're": "they are",
  "i'll": "i will",
  "you'll": "you will",
  "he'll": "he will",
  "she'll": "she will",
  "we'll": "we will",
  "they'll": "they will",
  "i'd": "i would",
  "you'd": "you would",
  "he'd": "he would",
  "she'd": "she would",
  "we'd": "we would",
  "they'd": "they would",
  "i've": "i have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "won't": "will not",
  "wouldn't": "would not",
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "can't": "cannot",
  "couldn't": "could not",
  "shouldn't": "should not",
  "mustn't": "must not",
  "needn't": "need not",
  "let's": "let us",
  "that's": "that is",
  "there's": "there is",
  "here's": "here is",
  "where's": "where is",
  "what's": "what is",
  "who's": "who is",
  "how's": "how is",
};

// دالة تطبيع النص
const normalizeText = (text) => {
  if (!text || typeof text !== "string") return "";

  let normalized = text
    .toLowerCase()
    .trim()
    // إزالة علامات الترقيم والرموز الخاصة
    .replace(/[^\w\s']/g, " ")
    // معالجة المسافات المتعددة
    .replace(/\s+/g, " ")
    .trim();

  // استبدال الاختصارات
  Object.entries(CONTRACTIONS_MAP).forEach(([contraction, expansion]) => {
    const regex = new RegExp(`\\b${contraction}\\b`, "gi");
    normalized = normalized.replace(regex, expansion);
  });

  // تنظيف نهائي
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
};

// دالة حساب المسافة بين الكلمات (Levenshtein distance)
const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // استبدال
          matrix[i][j - 1] + 1, // إدراج
          matrix[i - 1][j] + 1 // حذف
        );
      }
    }
  }

  return matrix[len2][len1];
};

// دالة حساب التشابه المحسنة
const calculateSimilarity = (userText, originalText) => {
  const normalizedUser = normalizeText(userText);
  const normalizedOriginal = normalizeText(originalText);

  if (normalizedUser === normalizedOriginal) {
    return 100;
  }

  const userWords = normalizedUser
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const originalWords = normalizedOriginal
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (originalWords.length === 0) return 0;
  if (userWords.length === 0) return 0;

  let exactMatches = 0;
  let partialMatches = 0;

  for (let i = 0; i < Math.min(userWords.length, originalWords.length); i++) {
    const userWord = userWords[i];
    const originalWord = originalWords[i];

    if (userWord === originalWord) {
      exactMatches++;
    } else {
      const distance = levenshteinDistance(userWord, originalWord);
      const maxLen = Math.max(userWord.length, originalWord.length);
      const similarity = maxLen > 0 ? (maxLen - distance) / maxLen : 0;

      if (similarity >= 0.7) {
        partialMatches += similarity;
      }
    }
  }

  const totalScore = (exactMatches + partialMatches) / originalWords.length;
  const lengthPenalty =
    Math.abs(userWords.length - originalWords.length) / originalWords.length;

  const finalScore = Math.max(0, totalScore - lengthPenalty * 0.3) * 100;

  return Math.min(100, Math.round(finalScore));
};

const evaluatePronunciation = (userText, originalText, confidence) => {
  const similarity = calculateSimilarity(userText, originalText);
  const confidenceScore = (confidence || 0) * 100;

  // If text is perfectly matched, give 100%
  if (similarity === 100) {
    return {
      level: "excellent",
      message: "ممتاز! نطق مثالي 🎉",
      color: "green",
      score: 100,
    };
  }

  // Otherwise calculate weighted score
  const overall = similarity * 0.85 + confidenceScore * 0.15;

  if (overall >= 90)
    return {
      level: "excellent",
      message: "ممتاز! نطق مثالي 🎉",
      color: "green",
      score: Math.round(overall),
    };
  if (overall >= 75)
    return {
      level: "very-good",
      message: "جيد جداً! نطق واضح 👏",
      color: "blue",
      score: Math.round(overall),
    };
  if (overall >= 60)
    return {
      level: "good",
      message: "جيد، يمكن تحسينه قليلاً 💪",
      color: "yellow",
      score: Math.round(overall),
    };
  if (overall >= 40)
    return {
      level: "needs-improvement",
      message: "يحتاج تحسين، حاول مرة أخرى 🔄",
      color: "orange",
      score: Math.round(overall),
    };
  return {
    level: "poor",
    message: "تحتاج إلى ممارسة أكثر 📚",
    color: "red",
    score: Math.round(overall),
  };
};

/* =================== Permission Banner =================== */
const MicrophonePermissionAlert = ({ permission, onRequestPermission }) => {
  if (permission !== "denied") return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg z-50 max-w-md w-full">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium">
            إذن الميكروفون مغلق. لن تتمكن من تسجيل نطقك. الرجاء السماح بالوصول
            إلى الميكروفون في إعدادات المتصفح.
          </p>
          <button
            onClick={onRequestPermission}
            className="mt-2 text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
          >
            طلب الإذن مرة أخرى
          </button>
        </div>
      </div>
    </div>
  );
};
MicrophonePermissionAlert.propTypes = {
  permission: PropTypes.string,
  onRequestPermission: PropTypes.func.isRequired,
};

/* ====================== RecordingModal ====================== */
const RecordingModal = ({
  isOpen,
  isRecording,
  isWaitingForRecording,
  recordingResult,
  originalText,
  sentenceAudioUrl,
  onStartRecording,
  onSkipRecording,
  onContinue,
  onRetry,
  playAudioFile,
  playRecordedAudio,
  audioLevels,
  // AssemblyAI props
  useAssemblyAI = false,
  isProcessingAssemblyAI = false,
  assemblyAIProgress = "",
  stopAssemblyAIRecording,
  setUseAssemblyAI,
  startRecording,
}) => {
  if (!isOpen) return null;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onSkipRecording?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkipRecording]);

  const title = isRecording
    ? "جارٍ التسجيل"
    : recordingResult
    ? recordingResult.success
      ? "نتيجة التقييم"
      : "خطأ في التسجيل"
    : "سجّل نُطقك الآن";

  const tokens = useMemo(() => {
    const words = (originalText || "").trim().split(/\s+/).filter(Boolean);
    const fakePh = (t) =>
      t
        .toLowerCase()
        .replace(/[^a-z']/g, "")
        .replace(/([aeiouy]+)/g, "$1-")
        .replace(/-$/, "")
        .replace(/--+/g, "-");
    return words.map((w, i) => ({
      word: w,
      phon: fakePh(w) || w.toLowerCase(),
      id: `${w}-${i}`,
    }));
  }, [originalText]);

  const resultTone =
    recordingResult?.evaluation?.color === "green"
      ? "border-green-500 bg-green-50 text-green-800"
      : recordingResult?.evaluation?.color === "blue"
      ? "border-blue-500 bg-blue-50 text-blue-800"
      : recordingResult?.evaluation?.color === "yellow"
      ? "border-yellow-500 bg-yellow-50 text-yellow-800"
      : recordingResult?.evaluation?.color === "orange"
      ? "border-orange-500 bg-orange-50 text-orange-800"
      : "border-red-500 bg-red-50 text-red-800";

  // Enhanced word highlighting with smart comparison
  const highlightWords = (orig, user) => {
    if (!orig || !user) return null;

    const normalizedOriginal = normalizeText(orig);
    const normalizedUser = normalizeText(user);

    const originalWords = normalizedOriginal
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const userWords = normalizedUser.split(/\s+/).filter((w) => w.length > 0);

    const displayOriginalWords = orig.trim().split(/\s+/);

    const items = displayOriginalWords.map((displayWord, i) => {
      const normalizedDisplayWord = normalizeText(displayWord);
      const userWord = userWords[i] || "";

      let isCorrect = false;
      let similarity = 0;
      let matchType = "none";

      if (userWord && normalizedDisplayWord) {
        if (normalizedDisplayWord === userWord) {
          isCorrect = true;
          similarity = 100;
          matchType = "exact";
        } else {
          const distance = levenshteinDistance(normalizedDisplayWord, userWord);
          const maxLen = Math.max(
            normalizedDisplayWord.length,
            userWord.length
          );
          similarity = maxLen > 0 ? ((maxLen - distance) / maxLen) * 100 : 0;

          if (similarity >= 80) {
            isCorrect = true;
            matchType = "close";
          } else if (similarity >= 60) {
            isCorrect = false;
            matchType = "partial";
          } else {
            isCorrect = false;
            matchType = "wrong";
          }
        }
      }

      return {
        word: displayWord,
        isCorrect,
        userWord,
        similarity: Math.round(similarity),
        matchType,
        normalizedWord: normalizedDisplayWord,
      };
    });

    return (
      <div className="space-y-2">
        <div
          className="arabic_font text-lg leading-relaxed"
          dir="ltr"
          style={{ textAlign: "left" }}
        >
          {items.map((it, idx) => (
            <span key={idx}>
              <span
                className={`inline-block rounded-md font-bold transition-all px-1 ${
                  it.matchType === "exact"
                    ? "text-green-800 bg-green-100"
                    : it.matchType === "close"
                    ? "text-blue-800 bg-blue-100"
                    : it.matchType === "partial"
                    ? "text-yellow-800 bg-yellow-100"
                    : "text-red-800 bg-red-100"
                }`}
                title={
                  it.isCorrect
                    ? `نطق صحيح (${it.similarity}%)`
                    : `متوقع: ${it.word}، نطقت: ${it.userWord || "لا شيء"} (${
                        it.similarity
                      }%)`
                }
              >
                {it.word}
              </span>
              {idx < items.length - 1 && " "}
            </span>
          ))}
        </div>

        {/* مؤشر الألوان */}
        <div className="flex flex-wrap gap-2 text-xs mt-3 pt-2 border-t border-gray-200">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div>
            <span className="text-gray-600 arabic_font">مطابقة تامة</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></div>
            <span className="text-gray-600 arabic_font">مطابقة قريبة</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></div>
            <span className="text-gray-600 arabic_font">مطابقة جزئية</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-100 border border-red-300"></div>
            <span className="text-gray-600 arabic_font">غير مطابق</span>
          </div>
        </div>
      </div>
    );
  };

  // Recording animation bars
  const BAR_COUNT = 28;
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => setSeed((n) => (n + 1) % 1e6), 120);
    return () => clearInterval(id);
  }, [isRecording]);
  const bars = useMemo(() => {
    const arr = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      arr.push(8 + ((i * 37 + seed * 13) % 28));
    }
    return arr;
  }, [seed]);

  const [elapsed, setElapsed] = useState(0);
  const startTsRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    if (isRecording) {
      startTsRef.current = performance.now();
      setElapsed(0);
      const tick = (now) => {
        const s = Math.floor((now - startTsRef.current) / 1000);
        setElapsed(s);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startTsRef.current = null;
    }
  }, [isRecording]);
  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(
      2,
      "0"
    )}`;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="fixed left-0 right-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl bg-white shadow-2xl border-t border-gray-100"
        role="dialog"
        aria-modal="true"
      >
        <div className="relative px-5 pt-4 pb-3 border-b">
          <p className="text-center text-[22px] font-bold text-[var(--secondary-color)]">
            Your turn!
          </p>
          <p className="text-center text-sm text-gray-600">
            Press the{" "}
            <span className="inline-flex translate-y-[2px]">
              <IoIosMic className="text-[var(--secondary-color)]" />
            </span>{" "}
            and record your voice.
          </p>
        </div>

        <div className="px-5 pt-3">
          <h3 className="arabic_font text-center text-[15px] text-gray-700">
            {title}
          </h3>
        </div>

        <div className="px-4 py-5">
          {originalText && (
            <div className="mx-auto w-full rounded-2xl border border-gray-200 bg-white/60 backdrop-blur-sm shadow-sm p-4">
              <div className="flex flex-wrap items-end justify-center gap-x-2 gap-y-3 select-none">
                {tokens.map((t, i) => (
                  <div key={t.id} className="text-center">
                    <div className="px-1">
                      <span className="text-[20px] font-semibold text-gray-900 border-b-2 border-dotted border-gray-400">
                        {t.word}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] leading-none text-gray-500 flex items-center justify-center gap-1">
                      {i === tokens.length - 1 && (
                        <Globe2 size={12} className="opacity-70" />
                      )}
                      <span className="font-medium">{t.phon}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!recordingResult && (
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() =>
                  sentenceAudioUrl && playAudioFile(sentenceAudioUrl, 1)
                }
                disabled={!sentenceAudioUrl}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-gray-800 text-sm font-medium ${
                  sentenceAudioUrl
                    ? "bg-gray-100 hover:bg-gray-200"
                    : "bg-gray-100 opacity-50 cursor-not-allowed"
                }`}
              >
                <Volume2 size={16} />
                Listen
              </button>

              <button
                onClick={
                  isRecording
                    ? useAssemblyAI
                      ? stopAssemblyAIRecording
                      : onContinue
                    : onStartRecording
                }
                className={[
                  "grid place-items-center rounded-full shadow-lg transition-all",
                  "w-[72px] h-[72px]",
                  isRecording
                    ? "bg-[var(--secondary-color)] text-white hover:bg-[var(--primary-color)]"
                    : "bg-[var(--secondary-color)] text-white hover:bg-[var(--primary-color)]",
                ].join(" ")}
                title={
                  isRecording
                    ? useAssemblyAI
                      ? "Stop Recording"
                      : "Send"
                    : "Tap to start speaking"
                }
                aria-label="Record"
              >
                {isRecording ? (
                  <Loader2 className="animate-spin" size={26} />
                ) : (
                  <IoIosMic size={30} />
                )}
              </button>

              <button
                onClick={() =>
                  sentenceAudioUrl && playAudioFile(sentenceAudioUrl, 0.75)
                }
                disabled={!sentenceAudioUrl}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-gray-800 text-sm font-medium ${
                  sentenceAudioUrl
                    ? "bg-gray-100 hover:bg-gray-200"
                    : "bg-gray-100 opacity-50 cursor-not-allowed"
                }`}
                title="Listen (slow)"
              >
                <Turtle size={16} />
                Listen (slow)
              </button>

              {!useAssemblyAI && (
                <button
                  onClick={() => {
                    setUseAssemblyAI(true);
                    startRecording();
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-blue-800 text-xs font-medium bg-blue-100 hover:bg-blue-200"
                  title="Use AssemblyAI for better recognition"
                >
                  🤖 AssemblyAI
                </button>
              )}
            </div>
          )}

          {isRecording && (
            <div className="mt-5 flex flex-col items-center gap-3">
              <div className="w-full max-w-md">
                <div className="relative w-full rounded-full bg-gradient-to-r from-[var(--primary-color)] to-[var(--secondary-color)] text-white px-3 py-2 flex items-center shadow-lg">
                  <button
                    onClick={onSkipRecording}
                    className="shrink-0 mr-2 p-1.5 rounded-full hover:bg-white/10"
                    title="حذف"
                    aria-label="حذف التسجيل"
                  >
                    <Trash2 size={18} />
                  </button>

                  <div className="flex-1 flex flex-col items-center">
                    <div className="h-10 flex items-center justify-center gap-[3px] w-full max-w-[300px]">
                      {audioLevels.map((h, idx) => (
                        <span
                          key={idx}
                          className="inline-block w-[2.5px] rounded-full bg-white/95 transition-all duration-100 ease-linear shadow-sm"
                          style={{ height: `${h}px` }}
                        />
                      ))}
                    </div>
                    <div className="arabic_font text-[11px] mt-1 opacity-90 tracking-wider font-mono">
                      {fmt(elapsed)}
                    </div>
                  </div>

                  <button
                    onClick={onContinue}
                    className="arabic_font flex items-center justify-center shrink-0 ml-2 p-2 rounded-full bg-white text-[var(--secondary-color)] hover:bg-white/70"
                    title="إرسال"
                    aria-label="إرسال التسجيل"
                  >
                    <IoIosSend size={20} className="flex" />
                  </button>
                </div>
              </div>

              <p className="text-gray-700 text-sm arabic_font font-medium">
                {isProcessingAssemblyAI ? (
                  <>
                    🔄 {assemblyAIProgress}
                    <span className="text-xs text-blue-600 block mt-1">
                      🤖 معالجة بواسطة AssemblyAI
                    </span>
                  </>
                ) : (
                  <>
                    🎤 جارٍ التسجيل... تحدث بوضوح
                    {isAndroid() && (
                      <span className="text-xs text-blue-600 block mt-1">
                        {useAssemblyAI
                          ? "🤖 AssemblyAI + 📱 أندرويد"
                          : "📱 محسّن للأندرويد"}
                      </span>
                    )}
                    {!isAndroid() && useAssemblyAI && (
                      <span className="text-xs text-blue-600 block mt-1">
                        🤖 معالجة بواسطة AssemblyAI
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          )}

          {recordingResult && (
            <div className="mt-6 space-y-5">
              {recordingResult.success ? (
                <>
                  <div className={`mb-1 p-4 rounded-xl border-2 ${resultTone}`}>
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 mt-0.5 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M20 6L9 17l-5-5"
                        />
                      </svg>
                      <div>
                        <p className="text-base font-bold arabic_font">
                          {recordingResult.evaluation.message}
                        </p>
                        <p className="text-sm mt-1 arabic_font">
                          التشابه: {recordingResult.evaluation.score}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                    <p className="arabic_font text-sm text-gray-600 mb-3 font-bold">
                      تحليل الكلمات:
                    </p>
                    {highlightWords(
                      recordingResult.originalText,
                      recordingResult.userText
                    )}
                  </div>

                  <div className="rounded-lg border border-blue-200 p-3 bg-blue-50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="arabic_font text-xs text-blue-600 font-bold">
                        ما قلته:
                      </p>
                      <button
                        onClick={() =>
                          recordingResult.audioUrl &&
                          playRecordedAudio(recordingResult.audioUrl)
                        }
                        disabled={!recordingResult.audioUrl}
                        className={`inline-flex arabic_font items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                          recordingResult.audioUrl
                            ? "bg-blue-100 hover:bg-blue-200 text-blue-700 cursor-pointer"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                        title={
                          recordingResult.audioUrl
                            ? "استمع لصوتك المسجل"
                            : "التسجيل غير متاح"
                        }
                      >
                        <Volume2 size={14} />
                        استمع لصوتك
                      </button>
                    </div>
                    <p className="arabic_font text-left text-blue-900 font-medium">
                      {recordingResult.userText}
                    </p>
                  </div>

                  {/* Retry button for scores below 50% */}
                  {recordingResult.evaluation.score < 50 ? (
                    <div className="flex gap-2">
                      <button
                        onClick={onRetry}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
                      >
                        <RotateCcw size={18} />
                        <span className="arabic_font">إعادة المحاولة</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={onContinue}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors"
                    >
                      <span className="arabic_font">متابعة للجملة التالية</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border-2 border-red-500 bg-red-50 text-red-800">
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 mt-0.5 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v4m0 4h.01M10.29 3.86l-8.48 14.7A2 2 0 003.53 22h16.94a2 2 0 001.72-3.44l-8.48-14.7a2 2 0 00-3.42 0z"
                        />
                      </svg>
                      <div>
                        <p className="font-semibold arabic_font">
                          لم يتم تسجيل نطق صالح
                        </p>
                        <p className="text-sm mt-1 arabic_font">
                          {recordingResult.message}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                      <p className="text-xs arabic_font text-gray-500 mb-1">
                        الجملة الأصلية
                      </p>
                      <p className="text-gray-900">
                        {recordingResult.originalText}
                      </p>
                    </div>
                    {recordingResult.userText ? (
                      <div className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-gray-500">ما سُمع</p>
                          <button
                            onClick={() =>
                              recordingResult.audioUrl &&
                              playRecordedAudio(recordingResult.audioUrl)
                            }
                            disabled={!recordingResult.audioUrl}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                              recordingResult.audioUrl
                                ? "bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
                                : "bg-gray-100 text-gray-400 cursor-not-allowed"
                            }`}
                            title={
                              recordingResult.audioUrl
                                ? "استمع لصوتك المسجل"
                                : "التسجيل غير متاح"
                            }
                          >
                            <Volume2 size={14} />
                            استمع لصوتك
                          </button>
                        </div>
                        <p className="text-gray-900">
                          {recordingResult.userText}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* Retry button for failed recording */}
                  <div className="flex gap-2">
                    <button
                      onClick={onRetry}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
                    >
                      <RotateCcw size={18} />
                      <span className="arabic_font">إعادة المحاولة</span>
                    </button>
                    <button
                      onClick={onContinue}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-medium transition-colors"
                    >
                      <span className="arabic_font">تخطي والمتابعة</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
RecordingModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  isRecording: PropTypes.bool.isRequired,
  originalText: PropTypes.string.isRequired,
  sentenceAudioUrl: PropTypes.string,
  isWaitingForRecording: PropTypes.bool.isRequired,
  recordingResult: PropTypes.shape({
    success: PropTypes.bool,
    message: PropTypes.string,
    userText: PropTypes.string,
    originalText: PropTypes.string,
    audioUrl: PropTypes.string,
    evaluation: PropTypes.shape({
      level: PropTypes.string,
      message: PropTypes.string,
      color: PropTypes.string,
      score: PropTypes.number,
    }),
    confidence: PropTypes.number,
  }),
  onStartRecording: PropTypes.func.isRequired,
  onSkipRecording: PropTypes.func.isRequired,
  onContinue: PropTypes.func.isRequired,
  onRetry: PropTypes.func.isRequired,
  playAudioFile: PropTypes.func.isRequired,
  playRecordedAudio: PropTypes.func.isRequired,
  audioLevels: PropTypes.arrayOf(PropTypes.number).isRequired,
};

/* ============================== Clickable Word ============================== */
const ClickableWord = ({
  word,
  isLast,
  onWordClick,
  activeWord,
  wordDefinitions,
  onPlayWordAudio,
}) => {
  const handleClick = useCallback(() => {
    const cleanWord = word.replace(/[.,!?;:'"]/g, "");
    const wordData = wordDefinitions[cleanWord];
    onPlayWordAudio(cleanWord);
    onWordClick({
      word: cleanWord,
      translation: wordData ? wordData.translation : "ترجمة غير متوفرة",
      definition: wordData ? wordData.definition : "Definition not available",
      partOfSpeech: wordData ? wordData.partOfSpeech : "word",
      rank: wordData ? wordData.rank : Math.floor(Math.random() * 1000) + 1,
    });
  }, [word, onWordClick, wordDefinitions, onPlayWordAudio]);

  const cleanWord = word.replace(/[.,!?;:'"]/g, "");
  const punctuation = word.slice(cleanWord.length);
  const isActive = activeWord === cleanWord;

  return (
    <>
      <span
        className={`text-black font-semibold text-xl hover:bg-blue-100 cursor-pointer rounded transition-all duration-200 ${
          isActive
            ? "border border-black p-1 bg-blue-50 shadow-sm"
            : "border border-transparent"
        }`}
        onClick={handleClick}
      >
        {cleanWord}
      </span>
      {punctuation && <span className="text-black">{punctuation}</span>}
      {!isLast && <span> </span>}
    </>
  );
};
ClickableWord.propTypes = {
  word: PropTypes.string.isRequired,
  isLast: PropTypes.bool.isRequired,
  onWordClick: PropTypes.func.isRequired,
  activeWord: PropTypes.string,
  wordDefinitions: PropTypes.object.isRequired,
  onPlayWordAudio: PropTypes.func.isRequired,
};

/* ================================= Sentence ================================ */
const Sentence = React.forwardRef(
  (
    {
      sentence,
      onWordClick,
      activeWord,
      isCurrentlyReading,
      wordDefinitions,
      pronunciationScore,
      onPlaySentenceAudio,
      onPlayWordAudio,
    },
    ref
  ) => {
    const words = sentence.text.split(" ");
    return (
      <div ref={ref} className="relative">
        <div className="flex items-center mb-2">
          <p
            className={`text-lg leading-relaxed w-fit text-gray-800 transition-all duration-500 rounded-lg ${
              isCurrentlyReading
                ? "underline underline-offset-8 decoration-4 decoration-red-500 shadow-xl transform scale-[1.02] bg-yellow-50 p-2"
                : "hover:bg-gray-50 p-2"
            }`}
          >
            {words.map((word, index) => (
              <ClickableWord
                key={index}
                word={word}
                isLast={index === words.length - 1}
                onWordClick={onWordClick}
                activeWord={activeWord}
                wordDefinitions={wordDefinitions}
                onPlayWordAudio={onPlayWordAudio}
              />
            ))}
          </p>

          {sentence.audioUrl && (
            <button
              onClick={() => onPlaySentenceAudio(sentence.audioUrl)}
              className="ml-2 p-2 bg-blue-100 hover:bg-blue-200 rounded-full"
              title="تشغيل الجملة"
            >
              <Volume2 size={16} className="text-blue-600" />
            </button>
          )}
        </div>

        {typeof pronunciationScore === "number" && (
          <div
            className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              pronunciationScore >= 85
                ? "bg-green-100 text-green-800"
                : pronunciationScore >= 70
                ? "bg-blue-100 text-blue-800"
                : pronunciationScore >= 50
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {pronunciationScore}
          </div>
        )}
      </div>
    );
  }
);
Sentence.displayName = "Sentence";
Sentence.propTypes = {
  sentence: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    text: PropTypes.string.isRequired,
    audioUrl: PropTypes.string,
  }).isRequired,
  onWordClick: PropTypes.func.isRequired,
  activeWord: PropTypes.string,
  isCurrentlyReading: PropTypes.bool,
  wordDefinitions: PropTypes.object.isRequired,
  pronunciationScore: PropTypes.number,
  onPlaySentenceAudio: PropTypes.func.isRequired,
  onPlayWordAudio: PropTypes.func.isRequired,
};

/* ================================= Sidebar ================================ */
const Sidebar = ({ isOpen, selectedWordData, onClose, onPlayWordAudio }) => {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        } lg:hidden`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 top-[50%] translate-y-[-50%] right-3 overflow-hidden rounded-3xl w-full max-w-xs sm:max-w-sm md:w-96 bg-white shadow-xl z-50 transform transition-all h-full duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-[135%]"
        } flex flex-col`}
      >
        <div className="flex justify-end p-4 sm:p-x-6">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 hover:rotate-90 transform origin-center"
            aria-label="Close sidebar"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {selectedWordData ? (
            <>
              <div className="bg-gradient-to-br from-[var(--secondary-color)] to-[var(--primary-color)] p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <h2 className="text-xl sm:text-2xl font-bold text-white break-all">
                    {selectedWordData.word}
                  </h2>
                  <button
                    onClick={() => onPlayWordAudio(selectedWordData.word)}
                    className="p-2 bg-white hover:bg-gray-100 rounded-full shadow-sm transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-200 active:scale-95 ml-2"
                    aria-label="Play pronunciation"
                  >
                    <Volume2 size={20} className="text-blue-600" />
                  </button>
                </div>
                <p className="text-base sm:text-lg text-white font-medium mb-3 sm:mb-4">
                  {selectedWordData.translation}
                </p>
              </div>
              {selectedWordData.definition && (
                <div className="space-y-2">
                  <h4 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Definition
                  </h4>
                  <p className="text-sm sm:text-base text-gray-700">
                    {selectedWordData.definition}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 sm:p-8">
              <BookOpen size={28} className="text-gray-300 mb-3 sm:mb-4" />
              <h4 className="text-base sm:text-lg font-medium text-gray-500 mb-1">
                No word selected
              </h4>
              <p className="text-xs sm:text-sm text-gray-400">
                Click on any word to see its details here
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
Sidebar.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  selectedWordData: PropTypes.shape({
    word: PropTypes.string,
    translation: PropTypes.string,
    definition: PropTypes.string,
    partOfSpeech: PropTypes.string,
    rank: PropTypes.number,
  }),
  onClose: PropTypes.func.isRequired,
  onPlayWordAudio: PropTypes.func.isRequired,
};

/* ================================ ShowLesson ================================ */
export function ShowLesson() {
  const { levelId, lessonId } = useParams();
  const lessonIdNum = parseInt(lessonId);

  const currentLesson = levelsAndLesson
    .find((level) => level.id == levelId)
    .lessons.find((lesson) => lesson.id == lessonIdNum);
  const currentLevel = levelsAndLesson.find((level) => level.id == levelId);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedWordData, setSelectedWordData] = useState(null);
  const [activeWord, setActiveWord] = useState(null);
  const [isReading, setIsReading] = useState(false);
  const [currentReadingSentenceId, setCurrentReadingSentenceId] =
    useState(null);
  const [autoScroll] = useState(true);
  const [readingProgress, setReadingProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isWaitingForRecording, setIsWaitingForRecording] = useState(false);
  const [recordingResult, setRecordingResult] = useState(null);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [pronunciationEnabled] = useState(true);
  const [pronunciationScores, setPronunciationScores] = useState({});
  const [microphonePermission, setMicrophonePermission] = useState(null);
  const [audioLevels, setAudioLevels] = useState(Array(28).fill(8));

  // AssemblyAI states
  const [isProcessingAssemblyAI, setIsProcessingAssemblyAI] = useState(false);
  const [assemblyAIProgress, setAssemblyAIProgress] = useState("");
  const [useAssemblyAI, setUseAssemblyAI] = useState(false); // Auto-fallback flag

  // audio/voice
  const [voices, setVoices] = useState([]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const durationsRef = useRef({});
  const [lessonTotalDuration, setLessonTotalDuration] = useState(0);
  const [lessonElapsed, setLessonElapsed] = useState(0);

  const readingTimeoutRef = useRef(null);
  const readingStateRef = useRef({
    isReading: false,
    currentIndex: 0,
    shouldStop: false,
  });
  const sentenceRefs = useRef({});
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordedAudioRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const isRecordingActiveRef = useRef(false);
  const BAR_COUNT = 28;

  // --- preload lesson audio metadata
  useEffect(() => {
    let active = true;
    const loaders = [];
    if (currentLesson?.storyData?.content?.length) {
      currentLesson.storyData.content.forEach((s) => {
        if (s.audioUrl) {
          const a = new Audio();
          a.preload = "metadata";
          a.src = s.audioUrl;
          const onLoaded = () => {
            const d = Number.isFinite(a.duration) ? a.duration : 0;
            durationsRef.current[s.id] = d;
            if (active) {
              const total = Object.values(durationsRef.current).reduce(
                (acc, v) => acc + (Number.isFinite(v) ? v : 0),
                0
              );
              setLessonTotalDuration(total);
            }
          };
          a.addEventListener("loadedmetadata", onLoaded);
          loaders.push({ a, onLoaded });
        }
      });
    }
    return () => {
      active = false;
      loaders.forEach(({ a, onLoaded }) =>
        a.removeEventListener("loadedmetadata", onLoaded)
      );
    };
  }, [currentLesson]);

  const fmt = (s) => {
    if (!Number.isFinite(s)) return "00:00";
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const stepSeconds = (delta) => {
    if (audioRef.current && Number.isFinite(audioRef.current.currentTime)) {
      const next = Math.max(
        0,
        Math.min((audioRef.current.currentTime || 0) + delta, duration || 0)
      );
      audioRef.current.currentTime = next;
    }
  };

  const togglePlayPause = () =>
    isReading ? stopReading() : readAllSentences();

  const handleSpeedChange = (rate) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      try {
        audioRef.current.playbackRate = rate;
      } catch {}
    }
  };

  const sumDurationsBeforeIndex = useCallback(
    (idx) => {
      if (!currentLesson?.storyData?.content) return 0;
      let sum = 0;
      for (let i = 0; i < idx; i++) {
        const sid = currentLesson.storyData.content[i].id;
        sum += Number.isFinite(durationsRef.current[sid])
          ? durationsRef.current[sid]
          : 0;
      }
      return sum;
    },
    [currentLesson]
  );

  /* ------------------------------ Load voices ----------------------------- */
  useEffect(() => {
    if (!supportsTTS) return;
    const loadVoices = () =>
      setVoices(window.speechSynthesis.getVoices() || []);
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const pickVoice = useCallback(() => {
    if (!voices.length) return null;
    const byName =
      voices.find((v) =>
        (v.name || "")
          .toLowerCase()
          .includes(PREFERRED_VOICE_NAME.toLowerCase())
      ) ||
      voices.find((v) =>
        (v.voiceURI || "")
          .toLowerCase()
          .includes(PREFERRED_VOICE_NAME.toLowerCase())
      );
    if (byName) return byName;
    const byLang = voices.find((v) =>
      (v.lang || "")
        .toLowerCase()
        .startsWith(PREFERRED_VOICE_LANG.toLowerCase())
    );
    if (byLang) return byLang;
    return voices.find((v) => (v.lang || "").startsWith("en")) || voices[0];
  }, [voices]);

  const speak = useCallback(
    (text, rate = playbackRate) => {
      const toSay = (text || "").trim();
      if (!toSay) return;

      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {}
      }

      if (supportsTTS) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(toSay);
          const v = pickVoice();
          if (v) utter.voice = v;
          utter.lang = v?.lang || PREFERRED_VOICE_LANG || "en-US";
          utter.rate = Math.min(2, Math.max(0.4, rate || 1));
          utter.pitch = 1;
          utter.volume = 1;
          window.speechSynthesis.speak(utter);
          return;
        } catch (e) {
          console.error("TTS failed, fallback to MP3:", e);
        }
      }

      const url = `https://cdn13674550.b-cdn.net/SNA-audio/words/${toSay.toLowerCase()}.mp3`;
      audioRef.current = new Audio(url);
      try {
        audioRef.current.playbackRate = rate || 1;
      } catch {}
      audioRef.current
        .play()
        .catch((err) => console.error("TTS+MP3 fallback failed:", err));
    },
    [pickVoice, playbackRate]
  );

  /* -------------------------- Microphone permission -------------------------- */
  const checkMicrophonePermission = useCallback(async () => {
    try {
      if (navigator.permissions) {
        const permissionStatus = await navigator.permissions.query({
          name: "microphone",
        });
        setMicrophonePermission(permissionStatus.state);
        permissionStatus.onchange = () =>
          setMicrophonePermission(permissionStatus.state);

        if (isAndroid()) {
          console.log(
            `Android microphone permission: ${permissionStatus.state}`
          );
        }
      } else {
        // Fallback for browsers without permissions API (common on Android)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              ...(isAndroid() && { sampleRate: 44100 }),
            },
          });
          stream.getTracks().forEach((t) => t.stop());
          setMicrophonePermission("granted");

          if (isAndroid()) {
            console.log("Android microphone permission granted via fallback");
          }
        } catch (fallbackError) {
          console.error("Fallback permission check failed:", fallbackError);
          setMicrophonePermission("denied");
        }
      }
    } catch (error) {
      console.error("Permission check error:", error);
      if (error.name === "NotAllowedError") {
        setMicrophonePermission("denied");
        if (isAndroid()) {
          console.error("Android microphone permission denied");
        }
      } else {
        setMicrophonePermission("prompt");
      }
    }
  }, []);

  const requestMicrophonePermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(isAndroid() && {
            sampleRate: 44100,
            channelCount: 1,
          }),
        },
      });
      stream.getTracks().forEach((t) => t.stop());
      setMicrophonePermission("granted");

      if (isAndroid()) {
        console.log("Android microphone permission granted");
      }
      return true;
    } catch (error) {
      console.error("Microphone permission request failed:", error);
      setMicrophonePermission("denied");

      if (isAndroid()) {
        console.error(
          "Android microphone permission request failed:",
          error.message
        );
      }
      return false;
    }
  }, []);

  useEffect(() => {
    checkMicrophonePermission();
    initializeSpeechRecognition();
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {}
      }
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      // Clean up audio recording resources
      isRecordingActiveRef.current = false;
      if (silenceTimeoutRef.current) {
        cancelAnimationFrame(silenceTimeoutRef.current);
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (recordedAudioRef.current) {
        URL.revokeObjectURL(recordedAudioRef.current);
      }
    };
  }, [checkMicrophonePermission]);

  const initializeSpeechRecognition = () => {
    // Check for Speech Recognition support with Android-specific handling
    const hasSpeechRecognition =
      "webkitSpeechRecognition" in window || "SpeechRecognition" in window;

    if (!hasSpeechRecognition) {
      console.warn("Speech Recognition not supported on this device/browser");
      if (isAndroid()) {
        console.warn(
          "Android device detected - Speech Recognition may be limited"
        );
      }
      return;
    }

    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();

      // Android-specific configuration
      if (isAndroid()) {
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.maxAlternatives = 3; // More alternatives for Android
      } else {
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.maxAlternatives = 1;
      }

      recognitionRef.current.lang = "en-US";
      recognitionRef.current.onstart = () => {
        setIsRecording(true);
        startAudioRecording();
      };
      recognitionRef.current.onresult = (event) => {
        let bestTranscript = "";
        let bestConfidence = 0;

        // For Android, try to get the best result from multiple alternatives
        if (isAndroid() && event.results[0].length > 1) {
          for (let i = 0; i < event.results[0].length; i++) {
            const result = event.results[0][i];
            if (result.confidence > bestConfidence) {
              bestTranscript = result.transcript;
              bestConfidence = result.confidence;
            }
          }
        } else {
          bestTranscript = event.results[0][0].transcript;
          bestConfidence = event.results[0][0].confidence || 0.8; // Default confidence for Android
        }

        const transcript = bestTranscript.toLowerCase().trim();
        const confidence = bestConfidence;

        // Wait a bit for audio recording to finish (longer for Android)
        const delay = isAndroid() ? 500 : 200;
        setTimeout(() => {
          handleRecognitionResult(transcript, confidence);
        }, delay);
      };
      recognitionRef.current.onerror = (event) => {
        setIsRecording(false);
        setIsWaitingForRecording(false);
        stopAudioRecording();
        let errorMessage = "حدث خطأ في التسجيل. حاول مرة أخرى.";

        // Android-specific error handling
        if (isAndroid()) {
          switch (event.error) {
            case "no-speech":
              errorMessage =
                "لم يتم سماع أي صوت. تأكد من وضوح الصوت وحاول مرة أخرى.";
              break;
            case "audio-capture":
              errorMessage = "مشكلة في الوصول للميكروفون. تحقق من الأذونات.";
              break;
            case "not-allowed":
              errorMessage =
                "تم رفض إذن الميكروفون. فعّل الإذن من إعدادات المتصفح.";
              break;
            case "network":
              errorMessage =
                "مشكلة في الاتصال. تحقق من الإنترنت وحاول مرة أخرى.";
              break;
            case "service-not-allowed":
              errorMessage = "خدمة التعرف على الصوت غير متاحة حالياً.";
              break;
            default:
              errorMessage = `خطأ في التسجيل (${event.error}). حاول مرة أخرى.`;
          }
        } else {
          if (event.error === "no-speech") {
            errorMessage = "لم يتم سماع أي صوت. حاول مرة أخرى.";
          }
        }

        setRecordingResult({
          success: false,
          message: errorMessage,
          userText: "",
          originalText:
            currentLesson?.storyData?.content[
              readingStateRef.current.currentIndex - 1
            ]?.text || "",
          audioUrl: recordedAudioRef.current,
        });
        setShowRecordingModal(true);

        console.error(
          "Speech recognition error:",
          event.error,
          isAndroid() ? "(Android device)" : ""
        );

        // Try AssemblyAI as fallback if Web Speech API fails
        if (recordedAudioRef.currentBlob && !useAssemblyAI) {
          console.log("Attempting AssemblyAI fallback...");
          setUseAssemblyAI(true);
          processWithAssemblyAI(recordedAudioRef.currentBlob);
          return; // Don't show the error modal yet
        }
      };
      recognitionRef.current.onend = () => {
        setIsRecording(false);
        stopAudioRecording();
      };
    } catch (error) {
      console.error("Failed to initialize Speech Recognition:", error);
      if (isAndroid()) {
        console.error("Android Speech Recognition initialization failed");
      }
    }
  };

  // Start audio recording with MediaRecorder and silence detection
  const startAudioRecording = async () => {
    try {
      audioChunksRef.current = [];
      if (recordedAudioRef.current) {
        URL.revokeObjectURL(recordedAudioRef.current);
        recordedAudioRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(isAndroid() && {
            sampleRate: 44100,
            channelCount: 1,
          }),
        },
      });
      streamRef.current = stream;
      isRecordingActiveRef.current = true;

      // Get the best supported format for this device
      const bestFormat = getBestAudioFormat();
      let mediaRecorder;

      if (bestFormat) {
        console.log(
          `Using audio format: ${bestFormat}${
            isAndroid() ? " (Android optimized)" : ""
          }`
        );
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: bestFormat,
          ...(isAndroid() &&
            bestFormat.includes("webm") && {
              videoBitsPerSecond: 0,
              audioBitsPerSecond: 128000,
            }),
        });
      } else {
        console.warn("No supported audio format found, using default");
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const bestFormat = getBestAudioFormat() || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, {
          type: bestFormat,
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        recordedAudioRef.current = audioUrl;

        console.log(
          `Audio recorded with format: ${bestFormat}, size: ${
            audioBlob.size
          } bytes${isAndroid() ? " (Android)" : ""}`
        );

        // Store audioBlob for AssemblyAI processing if needed
        recordedAudioRef.currentBlob = audioBlob;

        // Clean up stream and audio context
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        isRecordingActiveRef.current = false;
      };

      mediaRecorder.start();

      // Start silence detection
      startSilenceDetection(stream);
    } catch (error) {
      console.error("Error starting audio recording:", error);
      isRecordingActiveRef.current = false;
    }
  };

  // Silence detection using Web Audio API with real-time waveform
  const startSilenceDetection = useCallback(
    (stream) => {
      try {
        // Android-specific audio context creation
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        const audioContextConfig = getAudioContextConfig();
        const audioContext = new AudioContextClass(audioContextConfig);
        audioContextRef.current = audioContext;

        // Resume audio context if suspended (common on mobile)
        if (audioContext.state === "suspended") {
          audioContext
            .resume()
            .then(() => {
              console.log(
                "Audio context resumed",
                isAndroid() ? "(Android)" : ""
              );
            })
            .catch((err) => {
              console.error("Failed to resume audio context:", err);
            });
        }

        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;
        analyser.fftSize = 128; // Reduced for faster processing
        analyser.smoothingTimeConstant = 0; // No smoothing for instant response

        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        let silenceStart = Date.now();
        let hasSpoken = false;

        // Android-specific thresholds (more sensitive)
        const SILENCE_THRESHOLD = isAndroid() ? 15 : 20;
        const SILENCE_DURATION = isAndroid() ? 2500 : 2000; // Longer silence for Android
        const MIN_SPEAKING_TIME = isAndroid() ? 800 : 500; // Longer minimum speaking time

        const detectSilence = () => {
          if (!isRecordingActiveRef.current) {
            setAudioLevels(Array(BAR_COUNT).fill(8));
            return;
          }

          analyser.getByteFrequencyData(dataArray);

          // Calculate average volume
          const average =
            dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

          // Update real-time waveform visualization
          const waveformData = [];
          const step = Math.floor(bufferLength / BAR_COUNT);
          for (let i = 0; i < BAR_COUNT; i++) {
            const index = i * step;
            const value = dataArray[index] || 0;
            // Map value (0-255) to height (8-36px) with more sensitivity
            const height = Math.max(8, Math.min(36, 8 + (value / 180) * 28)); // Increased sensitivity
            waveformData.push(height);
          }
          setAudioLevels(waveformData);

          if (average > SILENCE_THRESHOLD) {
            silenceStart = Date.now();
            hasSpoken = true;
          } else if (hasSpoken) {
            const silenceDuration = Date.now() - silenceStart;
            const speakingDuration =
              Date.now() - silenceStart + SILENCE_DURATION;

            if (
              silenceDuration > SILENCE_DURATION &&
              speakingDuration > MIN_SPEAKING_TIME
            ) {
              if (recognitionRef.current && isRecordingActiveRef.current) {
                try {
                  recognitionRef.current.stop();
                } catch (e) {
                  console.log("Recognition already stopped");
                }
              }
              return;
            }
          }

          if (silenceTimeoutRef.current) {
            cancelAnimationFrame(silenceTimeoutRef.current);
          }
          silenceTimeoutRef.current = requestAnimationFrame(detectSilence);
        };

        detectSilence();
      } catch (error) {
        console.error("Error setting up silence detection:", error);
      }
    },
    [BAR_COUNT]
  );

  // Stop audio recording
  const stopAudioRecording = () => {
    isRecordingActiveRef.current = false;

    if (silenceTimeoutRef.current) {
      cancelAnimationFrame(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    // Reset waveform to default
    setAudioLevels(Array(BAR_COUNT).fill(8));

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  /* --------------------------- Scroll to sentence --------------------------- */
  const scrollToCurrentSentence = useCallback(
    (sentenceId) => {
      if (autoScroll && sentenceRefs.current[sentenceId]) {
        sentenceRefs.current[sentenceId].scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    },
    [autoScroll]
  );

  const handleRecognitionResult = (transcript, confidence) => {
    const idx = readingStateRef.current.currentIndex - 1;
    const originalSentence = currentLesson.storyData.content[idx];
    if (originalSentence) {
      const evaluation = evaluatePronunciation(
        transcript,
        originalSentence.text,
        confidence
      );
      setRecordingResult({
        success: true,
        userText: transcript,
        originalText: originalSentence.text,
        evaluation,
        confidence: Math.round(confidence * 100),
        audioUrl: recordedAudioRef.current,
      });
      setPronunciationScores((prev) => ({
        ...prev,
        [originalSentence.id]: evaluation.score,
      }));
      setShowRecordingModal(true);
      setIsWaitingForRecording(false);
    }
  };

  // Process audio with AssemblyAI
  const processWithAssemblyAI = async (audioBlob) => {
    try {
      setIsProcessingAssemblyAI(true);
      setAssemblyAIProgress("جاري التحضير للمعالجة...");

      const result = await assemblyAIService.transcribeAudio(
        audioBlob,
        (progress) => setAssemblyAIProgress(progress)
      );

      setIsProcessingAssemblyAI(false);
      setAssemblyAIProgress("");

      // Process the result same as Web Speech API
      handleRecognitionResult(result.text, result.confidence);
    } catch (error) {
      console.error("AssemblyAI processing failed:", error);
      setIsProcessingAssemblyAI(false);
      setAssemblyAIProgress("");

      // Show error to user
      const idx = readingStateRef.current.currentIndex - 1;
      const originalSentence = currentLesson.storyData.content[idx];

      setRecordingResult({
        success: false,
        message: isAndroid()
          ? "فشل في معالجة التسجيل. تحقق من اتصال الإنترنت وحاول مرة أخرى."
          : "فشل في معالجة التسجيل. حاول مرة أخرى.",
        userText: "",
        originalText: originalSentence?.text || "",
        audioUrl: recordedAudioRef.current,
      });
      setShowRecordingModal(true);
      setIsWaitingForRecording(false);
    }
  };

  /* ------------------------------ Recording API ----------------------------- */
  const startRecording = useCallback(async () => {
    // If Web Speech API is not available, use AssemblyAI directly
    if (!recognitionRef.current) {
      console.log("Web Speech API not available, using AssemblyAI");
      setUseAssemblyAI(true);

      // Start audio recording for AssemblyAI
      if (microphonePermission === "denied") {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          const message = isAndroid()
            ? "تم رفض إذن الميكروفون. فعّل الإذن من إعدادات المتصفح أو إعدادات التطبيق."
            : "تم رفض إذن الميكروفون. فعِّل الإذن من إعدادات المتصفح.";
          alert(message);
          return;
        }
      }

      setRecordingResult(null);
      setIsRecording(true);
      startAudioRecording();
      return;
    }

    try {
      if (microphonePermission === "denied") {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          const message = isAndroid()
            ? "تم رفض إذن الميكروفون. فعّل الإذن من إعدادات المتصفح أو إعدادات التطبيق."
            : "تم رفض إذن الميكروفون. فعِّل الإذن من إعدادات المتصفح.";
          alert(message);
          return;
        }
      }

      setRecordingResult(null);

      // Additional Android checks
      if (isAndroid()) {
        // Check if audio context is supported
        if (!window.AudioContext && !window.webkitAudioContext) {
          console.warn("AudioContext not supported on this Android device");
        }

        // Check MediaRecorder support
        if (!window.MediaRecorder) {
          console.warn("MediaRecorder not supported on this Android device");
        }
      }

      recognitionRef.current.start();
    } catch (error) {
      setIsRecording(false);
      setIsWaitingForRecording(false);

      if (error.name === "NotAllowedError") {
        setMicrophonePermission("denied");
        const message = isAndroid()
          ? "تم رفض إذن الميكروفون. فعّل الإذن من إعدادات المتصفح أو إعدادات الجهاز."
          : "تم رفض إذن الميكروفون. الرجاء السماح بالوصول للميكروفون.";
        alert(message);
      } else if (error.name === "InvalidStateError") {
        console.error("Speech recognition is already active");
        alert("التسجيل قيد التشغيل بالفعل. انتظر حتى ينتهي.");
      } else {
        console.error("خطأ في بدء التسجيل:", error);
        const message = isAndroid()
          ? "حدث خطأ في بدء التسجيل على Android. تأكد من اتصال الإنترنت وحاول مرة أخرى."
          : "حدث خطأ في بدء التسجيل. حاول مرة أخرى.";
        alert(message);
      }
    }
  }, [microphonePermission, requestMicrophonePermission]);

  const skipRecording = () => {
    setIsWaitingForRecording(false);
    setShowRecordingModal(false);
    setIsProcessingAssemblyAI(false);
    setAssemblyAIProgress("");
    setUseAssemblyAI(false);

    // Clean up any recorded audio
    if (recordedAudioRef.current) {
      URL.revokeObjectURL(recordedAudioRef.current);
      recordedAudioRef.current = null;
    }
    if (recordedAudioRef.currentBlob) {
      recordedAudioRef.currentBlob = null;
    }
    continueToNextSentence();
  };

  // Manual stop for AssemblyAI recording
  const stopAssemblyAIRecording = () => {
    setIsRecording(false);
    stopAudioRecording();

    // Process with AssemblyAI when recording stops
    if (recordedAudioRef.currentBlob) {
      processWithAssemblyAI(recordedAudioRef.currentBlob);
    }
  };

  const continueToNextSentence = () => {
    setShowRecordingModal(false);
    setRecordingResult(null);
    // Clean up any recorded audio
    if (recordedAudioRef.current) {
      URL.revokeObjectURL(recordedAudioRef.current);
      recordedAudioRef.current = null;
    }
    if (!readingStateRef.current.shouldStop) {
      readingTimeoutRef.current = setTimeout(() => {
        window.speakNextSentence?.();
      }, 1000);
    }
  };

  const retryRecording = () => {
    // Clean up previous recording
    if (recordedAudioRef.current) {
      URL.revokeObjectURL(recordedAudioRef.current);
      recordedAudioRef.current = null;
    }
    setRecordingResult(null);
    setIsWaitingForRecording(false);
    // Start new recording immediately
    setTimeout(() => {
      startRecording();
    }, 300);
  };

  /* ------------------------------- Word Sidebar ------------------------------ */
  const handleWordClick = useCallback((wordData) => {
    setSelectedWordData(wordData);
    setActiveWord(wordData.word);
    setSidebarOpen(true);
  }, []);
  const closeSidebar = () => {
    setSidebarOpen(false);
    setActiveWord(null);
  };

  /* ------------------------------ Play sentence audio ------------------------------ */
  const playSentenceAudio = useCallback(
    (audioUrl) => {
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {}
      }
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      try {
        audio.playbackRate = playbackRate;
      } catch {}
      audio.onloadedmetadata = () => {
        const d = Number.isFinite(audio.duration) ? audio.duration : 0;
        setDuration(d);
      };
      audio.ontimeupdate = () => {
        const now = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        setCurrentTime(now);
        const base = sumDurationsBeforeIndex(
          readingStateRef.current.currentIndex
        );
        setLessonElapsed(base + now);
      };
      audio.onended = () => {
        setCurrentTime(0);
        const base = sumDurationsBeforeIndex(
          readingStateRef.current.currentIndex
        );
        setLessonElapsed(base);
      };
      audio.onerror = () => {
        setDuration(0);
        setCurrentTime(0);
      };
      audio.play().catch((e) => console.error("Error playing audio:", e));
    },
    [playbackRate, sumDurationsBeforeIndex]
  );

  const playAudioFile = useCallback((audioUrl, rate = 1) => {
    if (!audioUrl) {
      console.log("No audio file available");
      return;
    }

    // Stop any current audio
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    // Play audio file at specified rate
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    try {
      audio.playbackRate = rate;
    } catch {}
    audio.play().catch((err) => console.error("Error playing audio:", err));
  }, []);

  const playRecordedAudio = useCallback((audioUrl) => {
    if (!audioUrl) {
      console.log("No recorded audio available");
      return;
    }

    // Stop any current audio
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    // Play recorded audio
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio
      .play()
      .catch((err) => console.error("Error playing recorded audio:", err));
  }, []);

  const playWordAudio = useCallback(
    (word) => {
      const clean = (word || "").replace(/[^\w'-]/g, "");
      if (!clean) return;
      speak(clean);
    },
    [speak]
  );

  /* ------------------------------ Read all sentences ------------------------------ */
  const readAllSentences = useCallback(() => {
    if (!currentLesson || !currentLesson.storyData?.content?.length) return;

    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    readingStateRef.current = {
      isReading: true,
      currentIndex: 0,
      shouldStop: false,
    };
    setIsReading(true);
    setReadingProgress(0);
    setIsWaitingForRecording(false);
    setShowRecordingModal(false);

    const speakNextSentence = () => {
      const { currentIndex, shouldStop } = readingStateRef.current;
      const total = currentLesson.storyData.content.length;

      if (shouldStop || currentIndex >= total) {
        setIsReading(false);
        setCurrentReadingSentenceId(null);
        setReadingProgress(100);
        readingStateRef.current.isReading = false;
        if (loopEnabled && !shouldStop) {
          setTimeout(() => {
            if (!readingStateRef.current.shouldStop) readAllSentences();
          }, 400);
        }
        return;
      }

      const sentence = currentLesson.storyData.content[currentIndex];
      setLessonElapsed(sumDurationsBeforeIndex(currentIndex));
      const progress = ((currentIndex + 1) / total) * 100;

      setCurrentReadingSentenceId(sentence.id);
      setReadingProgress(progress);
      scrollToCurrentSentence(sentence.id);

      if (sentence.audioUrl) {
        playSentenceAudio(sentence.audioUrl);
        if (audioRef.current) {
          audioRef.current.onended = () => {
            if (!readingStateRef.current.shouldStop) {
              readingStateRef.current.currentIndex++;
              if (pronunciationEnabled) {
                setIsWaitingForRecording(true);
                setShowRecordingModal(true);
              } else {
                readingTimeoutRef.current = setTimeout(speakNextSentence, 500);
              }
            }
          };
          audioRef.current.onerror = () => {
            if (!readingStateRef.current.shouldStop) {
              readingStateRef.current.currentIndex++;
              if (pronunciationEnabled) {
                setIsWaitingForRecording(true);
                setShowRecordingModal(true);
              } else {
                readingTimeoutRef.current = setTimeout(speakNextSentence, 500);
              }
            }
          };
        }
      } else {
        readingStateRef.current.currentIndex++;
        if (pronunciationEnabled) {
          setIsWaitingForRecording(true);
          setShowRecordingModal(true);
        } else {
          readingTimeoutRef.current = setTimeout(speakNextSentence, 1000);
        }
      }
    };

    window.speakNextSentence = speakNextSentence;
    speakNextSentence();
  }, [
    currentLesson,
    scrollToCurrentSentence,
    pronunciationEnabled,
    playSentenceAudio,
    loopEnabled,
    sumDurationsBeforeIndex,
  ]);

  /* --------------------------------- Stop -------------------------------- */
  const stopReading = useCallback(() => {
    readingStateRef.current.shouldStop = true;
    readingStateRef.current.isReading = false;
    setIsReading(false);
    setCurrentReadingSentenceId(null);
    setReadingProgress(0);
    setIsWaitingForRecording(false);
    setShowRecordingModal(false);

    if (recognitionRef.current && isRecording) recognitionRef.current.abort();
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
    if (readingTimeoutRef.current) {
      clearTimeout(readingTimeoutRef.current);
      readingTimeoutRef.current = null;
    }
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setCurrentTime(0);
    setDuration(0);
    readingStateRef.current.currentIndex = 0;
  }, [isRecording]);

  useEffect(() => {
    return () => {
      readingStateRef.current.shouldStop = true;
      if (readingTimeoutRef.current) clearTimeout(readingTimeoutRef.current);
      if (recognitionRef.current) recognitionRef.current.abort();
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {}
      }
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    };
  }, []);

  /* ---------------------------------- UI ---------------------------------- */
  if (!currentLesson) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Lesson not found
          </h2>
          <p className="text-gray-500">
            The requested lesson could not be found.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const currentSentenceText =
    currentLesson?.storyData?.content?.[
      readingStateRef.current.currentIndex - 1
    ]?.text || "";

  const currentSentenceAudioUrl =
    currentLesson?.storyData?.content?.[
      readingStateRef.current.currentIndex - 1
    ]?.audioUrl || "";

  return (
    <div className="min-h-screen">
      <MicrophonePermissionAlert
        permission={microphonePermission}
        onRequestPermission={requestMicrophonePermission}
      />

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Link
              to="/"
              className="p-2 text-[var(--secondary-color)] hover:bg-gray-200 rounded-full transition-colors"
            >
              <X size={29} />
            </Link>
            {isReading && (
              <div className="flex items-center space-x-2">
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300 ease-out"
                    style={{ width: `${readingProgress}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">
                  {Math.round(readingProgress)}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-8 p-4 sm:p-0">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden flex-shrink-0 shadow-md">
            <img
              src={currentLevel.image}
              alt={currentLevel.name}
              className="object-cover w-full h-full"
            />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-800 mb-1 ">
              {currentLesson.title}
            </h1>
            <p className="text-gray-600 text-sm sm:text-base line-clamp-2">
              {currentLesson.description}
            </p>
          </div>
        </div>

        <div className="space-y-6 mb-24">
          {currentLesson.storyData.content.map((sentence) => (
            <Sentence
              key={sentence.id}
              ref={(el) => (sentenceRefs.current[sentence.id] = el)}
              sentence={sentence}
              onWordClick={handleWordClick}
              activeWord={activeWord}
              isCurrentlyReading={currentReadingSentenceId === sentence.id}
              wordDefinitions={currentLesson.wordDefinitions}
              pronunciationScore={pronunciationScores[sentence.id]}
              onPlaySentenceAudio={playSentenceAudio}
              onPlayWordAudio={playWordAudio}
            />
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        selectedWordData={selectedWordData}
        onClose={closeSidebar}
        onPlayWordAudio={playWordAudio}
      />

      {/* Recording modal */}
      <RecordingModal
        isOpen={showRecordingModal}
        isRecording={isRecording}
        isWaitingForRecording={isWaitingForRecording}
        recordingResult={recordingResult}
        onStartRecording={startRecording}
        originalText={currentSentenceText}
        sentenceAudioUrl={currentSentenceAudioUrl}
        onSkipRecording={skipRecording}
        onContinue={continueToNextSentence}
        onRetry={retryRecording}
        playAudioFile={playAudioFile}
        playRecordedAudio={playRecordedAudio}
        audioLevels={audioLevels}
        // AssemblyAI props
        useAssemblyAI={useAssemblyAI}
        isProcessingAssemblyAI={isProcessingAssemblyAI}
        assemblyAIProgress={assemblyAIProgress}
        stopAssemblyAIRecording={stopAssemblyAIRecording}
        setUseAssemblyAI={setUseAssemblyAI}
        startRecording={startRecording}
      />

      {/* Mini Player */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="mx-auto max-w-4xl">
          <div className="mx-4 mb-3 rounded-2xl bg-white shadow-[0_-6px_24px_rgba(0,0,0,0.08)] border border-gray-100">
            {/* Progress bar */}
            <div
              className="h-1 w-full bg-gray-200 rounded-t-2xl overflow-hidden cursor-pointer"
              onClick={(e) => {
                if (
                  !audioRef.current ||
                  !Number.isFinite(duration) ||
                  duration === 0
                )
                  return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.min(
                  1,
                  Math.max(0, (e.clientX - rect.left) / rect.width)
                );
                const t = ratio * duration;
                audioRef.current.currentTime = t;
              }}
            >
              <div
                className="h-full bg-[var(--primary-color)] transition-[width]"
                style={{
                  width: lessonTotalDuration
                    ? `${
                        (Math.min(lessonElapsed, lessonTotalDuration) /
                          lessonTotalDuration) *
                        100
                      }%`
                    : duration
                    ? `${(Math.min(currentTime, duration) / duration) * 100}%`
                    : `${readingProgress}%`,
                }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlayPause}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--primary-color)] text-white hover:bg-[var(--secondary-color)] transition-colors"
                  title={isReading ? "إيقاف" : "تشغيل"}
                >
                  {isReading ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <button
                  onClick={() => stepSeconds(-5)}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 grid place-items-center"
                  title="رجوع 5 ثوانٍ"
                >
                  <RotateCcw size={18} />
                </button>

                <button
                  onClick={() => stepSeconds(5)}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 grid place-items-center"
                  title="تقديم 5 ثوانٍ"
                >
                  <RotateCcw size={18} className="-scale-x-100" />
                </button>

                <button
                  onClick={() => setLoopEnabled((v) => !v)}
                  className={`w-9 h-9 rounded-full grid place-items-center ${
                    loopEnabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-700"
                  } hover:bg-emerald-100`}
                  title="تكرار الدرس"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M17 1l4 4-4 4V6H7a3 3 0 00-3 3v2H2V9a5 5 0 015-5h10V1zm-10 22l-4-4 4-4v3h10a3 3 0 003-3v-2h2v2a5 5 0 01-5 5H7v3z" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-gray-600">
                <span className="tabular-nums">
                  {lessonTotalDuration
                    ? fmt(lessonElapsed)
                    : fmt(currentTime) || "00:00"}{" "}
                </span>
                <span className="text-gray-300">/</span>
                <span className="tabular-nums">
                  {lessonTotalDuration
                    ? fmt(lessonTotalDuration)
                    : duration
                    ? fmt(duration)
                    : `${Math.round(readingProgress)}%`}
                </span>
              </div>

              <div className="relative flex items-center gap-2">
                <div className="group relative">
                  <button
                    className="px-3 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium"
                    title="السرعة"
                  >
                    {playbackRate.toFixed(2).replace(/\.00$/, "")}x ▾
                  </button>
                  <div className="absolute -right-2 bottom-9 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {[0.75, 1, 1.25, 1.5, 1.75].map((r) => (
                      <button
                        key={r}
                        onClick={() => handleSpeedChange(r)}
                        className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                          Math.abs(playbackRate - r) < 0.001
                            ? "text-[var(--primary-color)] bg-gray-50 font-semibold"
                            : "text-gray-700"
                        }`}
                      >
                        {r}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz FAB */}
      <Link
        to={`/level/${levelId}/lesson/${lessonId}/quiz`}
        className="fixed bottom-20 right-6 bg-[var(--primary-color)] hover:bg-[var(--secondary-color)] text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center"
        style={{ width: "60px", height: "60px" }}
      >
        <PiExam size={30} />
      </Link>
    </div>
  );
}
