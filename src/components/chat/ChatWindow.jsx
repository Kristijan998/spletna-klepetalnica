import React, { useState, useEffect, useRef } from "react";
import { db } from "@/api/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, Circle, Paperclip, Camera, Smile, X, Download, Image as ImageIcon, Check, CheckCheck, Loader2 } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function ChatWindow({ room, myProfileId, myName, partnerName, onBack, onPartnerOffline }) {
  const darkMode = document.documentElement.classList.contains("dark");
  const currentYear = new Date().getFullYear();
  const getAge = (birthYear) => {
    const year = Number(birthYear);
    if (!Number.isFinite(year)) return null;
    if (year < 1900 || year > currentYear) return null;
    return currentYear - year;
  };
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [attachedImage, setAttachedImage] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [cameraMode, setCameraMode] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const lastPartnerOnlineRef = useRef(null);
  const uploadTimerRef = useRef(null);

  const partnerProfileId = room?.participant_ids?.find((id) => id !== myProfileId) || null;
  const normalizeReadBy = (value) => (Array.isArray(value) ? value : []);

  const MAX_BEFORE_REPLY = 3;
  const MAX_AFTER_REPLY = 5;
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
  const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20 MB
  const MAX_VIDEO_DURATION = 60; // 1 minute
  const t = (sl, en) => (document.documentElement.lang === "en" ? en : sl);

  const getVideoDuration = (file) =>
    new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(Number(video.duration));
      };
      video.onerror = () => resolve(null);
      video.src = URL.createObjectURL(file);
    });

  const clearUploadTimer = () => {
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }
  };

  const startUploadStatus = (file) => {
    if (!file) return;
    clearUploadTimer();

    const estimatedTotalSec = Math.max(3, Math.ceil((file.size || 0) / (1.5 * 1024 * 1024)));
    const startedAt = Date.now();

    setUploadStatus({
      fileName: file.name || "attachment",
      elapsedSec: 0,
      estimatedTotalSec,
    });

    uploadTimerRef.current = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
      setUploadStatus((prev) => (prev ? { ...prev, elapsedSec } : prev));
    }, 1000);
  };

  const stopUploadStatus = () => {
    clearUploadTimer();
    setUploadStatus(null);
  };

  const getSendQuota = (allMessages) => {
    const msgs = Array.isArray(allMessages) ? allMessages : [];
    const partnerId = partnerProfileId;

    if (!partnerId) {
      return { limit: MAX_BEFORE_REPLY, used: 0, remaining: MAX_BEFORE_REPLY, reason: "missing_partner" };
    }

    const partnerHasReplied = msgs.some((m) => m?.sender_profile_id === partnerId);

    if (!partnerHasReplied) {
      const used = msgs.filter((m) => m?.sender_profile_id === myProfileId).length;
      return {
        limit: MAX_BEFORE_REPLY,
        used,
        remaining: Math.max(0, MAX_BEFORE_REPLY - used),
        reason: "before_reply",
      };
    }

    // Count my messages since partner's last message.
    let lastPartnerIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]?.sender_profile_id === partnerId) {
        lastPartnerIdx = i;
        break;
      }
    }

    const tail = lastPartnerIdx >= 0 ? msgs.slice(lastPartnerIdx + 1) : msgs;
    const used = tail.filter((m) => m?.sender_profile_id === myProfileId).length;
    return {
      limit: MAX_AFTER_REPLY,
      used,
      remaining: Math.max(0, MAX_AFTER_REPLY - used),
      reason: "after_reply",
    };
  };

  const isProfileOnline = (profile) => {
    if (!profile?.is_online) return false;
    if (!profile?.last_activity) return true;
    const last = new Date(profile.last_activity).getTime();
    if (Number.isNaN(last)) return Boolean(profile.is_online);
    return Date.now() - last < 5 * 60 * 1000;
  };

  const partnerOnline = isProfileOnline(partnerProfile);

  const loadPartnerProfile = async () => {
    try {
      if (!partnerProfileId) {
        setPartnerProfile(null);
        return;
      }
      const matches = await db.entities.ChatProfile.filter({ id: partnerProfileId });
      setPartnerProfile(matches?.[0] || null);
    } catch (error) {
      console.error("Error loading partner profile:", error);
    }
  };

  useEffect(() => {
    if (!room?.id) return;

    loadMessages();
    loadPartnerProfile();
    const interval = setInterval(loadMessages, 3000);

    const checkTypingStatus = async () => {
      try {
        if (!partnerProfileId) return;
        const matches = await db.entities.ChatProfile.filter({ id: partnerProfileId });
        const partner = matches?.[0] || null;
        if (partner) setPartnerProfile(partner);
        setPartnerIsTyping(Boolean(partner?.is_typing));
      } catch (error) {
        console.error("Error checking typing status:", error);
      }
    };

    checkTypingStatus();
    const typingInterval = setInterval(checkTypingStatus, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(typingInterval);
    };
  }, [room?.id, partnerProfileId]);

  useEffect(() => () => clearUploadTimer(), []);

  useEffect(() => {
    if (!room?.id) return;
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel("local_db_updates");
    channel.onmessage = (event) => {
      const payload = event?.data || {};
      if (payload?.entity !== "ChatMessage") return;
      if (payload?.room_id && payload.room_id !== room.id) return;
      loadMessages();
    };

    return () => {
      channel.close();
    };
  }, [room?.id]);

  useEffect(() => {
    if (!room?.id) return;
    if (!partnerProfileId) return;
    if (!partnerProfile) return;

    const isOnlineNow = isProfileOnline(partnerProfile);

    if (lastPartnerOnlineRef.current === null) {
      lastPartnerOnlineRef.current = isOnlineNow;
      return;
    }

    const wasOnline = lastPartnerOnlineRef.current;
    lastPartnerOnlineRef.current = isOnlineNow;

    if (wasOnline && !isOnlineNow) {
      (async () => {
        try {
          if (room?.status === "active") {
            await db.entities.ChatRoom.update(room.id, { status: "inactive" });
          }
        } catch (error) {
          console.error("Error updating room status:", error);
        }

        if (typeof onPartnerOffline === "function") onPartnerOffline();
      })();
    }
  }, [partnerProfile, partnerProfileId, room?.id]);

  useEffect(() => {
    const markAsRead = async () => {
      try {
        const unreadMessages = messages.filter(
          (msg) =>
            msg.sender_profile_id !== myProfileId &&
            !normalizeReadBy(msg.read_by).includes(myProfileId)
        );

        if (unreadMessages.length === 0) return;

        for (const msg of unreadMessages) {
          const updatedReadBy = Array.from(new Set([...normalizeReadBy(msg.read_by), myProfileId]));
          await db.entities.ChatMessage.update(msg.id, {
            read_by: updatedReadBy,
            read_at: new Date().toISOString(),
          });
        }

        // Broadcast the update so other tabs/clients reload quickly
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const channel = new BroadcastChannel('local_db_updates');
            channel.postMessage({ entity: 'ChatMessage', action: 'update', room_id: room?.id });
            channel.close();
          } catch (e) {
            console.error('BroadcastChannel send error:', e);
          }
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    };

    if (messages.length > 0) {
      markAsRead();
    }
  }, [messages, myProfileId]);



  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    const msgs = await db.entities.ChatMessage.filter(
      { room_id: room.id },
      "created_date",
      500
    );
    setMessages(msgs);
    
    
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachedFile && !attachedImage) || sending) return;

    const content = newMessage.trim();
    setSending(true);

    const quota = getSendQuota(messages);
    if (quota.remaining <= 0) {
      if (quota.reason === "before_reply") {
        toast.error("Počakaj na odgovor partnerja, preveč sporočil.");
      } else {
        toast.error("Dosežena kvota za pošiljanje sporočil.");
      }
      setSending(false);
      return;
    }

    // Clear typing status
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    db.entities.ChatProfile.update(myProfileId, { is_typing: false }).catch(err => console.error("Error:", err));
    
    const messageData = {
      room_id: room.id,
      sender_profile_id: myProfileId,
      sender_name: myName,
      content: content || "",
      read_by: [myProfileId]
    };

    try {
      if (attachedImage) {
        if (!attachedImage.type?.startsWith("image/")) {
          toast.error(t(
            "Dovoljene so samo slike in videoposnetki.",
            "Only images and videos are allowed."
          ));
          setSending(false);
          return;
        }
        if (attachedImage.size > MAX_IMAGE_SIZE) {
          toast.error(t(
            "Presegli ste velikost slike za posiljanje (10 MB).",
            "Image file size exceeds 10 MB limit."
          ));
          setSending(false);
          return;
        }
      }

      if (attachedFile) {
        if (!attachedFile.type?.startsWith("video/")) {
          toast.error(t(
            "Dovoljeni so samo videoposnetki do 1 minute.",
            "Only videos up to 1 minute are allowed."
          ));
          setSending(false);
          return;
        }
        if (attachedFile.size > MAX_VIDEO_SIZE) {
          toast.error(t(
            "Presegli ste velikost videoposnetka za posiljanje (20 MB).",
            "Video file size exceeds 20 MB limit."
          ));
          setSending(false);
          return;
        }
        const duration = await getVideoDuration(attachedFile);
        if (duration === null || Number.isNaN(duration)) {
          toast.error(t(
            "Videoposnetka ni bilo mogoce preveriti.",
            "Could not validate video duration."
          ));
          setSending(false);
          return;
        }
        if (duration > MAX_VIDEO_DURATION) {
          toast.error(t(
            "Dovoljeni so le videoposnetki do 1 minute.",
            "Only videos up to 1 minute are allowed."
          ));
          setSending(false);
          return;
        }
      }

      const uploadCandidate = attachedImage || attachedFile;
      if (uploadCandidate) startUploadStatus(uploadCandidate);

      if (attachedFile) {
        const { file_url } = await db.integrations.Core.UploadFile({ file: attachedFile });
        messageData.file_url = file_url;
        messageData.file_name = attachedFile.name;
      }

      if (attachedImage) {
        const { file_url } = await db.integrations.Core.UploadFile({ file: attachedImage });
        messageData.image_url = file_url;
      }

      const createdMsg = await db.entities.ChatMessage.create(messageData);

      await db.entities.ChatRoom.update(room.id, {
        last_message: content || "📎 Priponka"
      });

      // Broadcast the new message/room update so other tabs/clients reorder and reload immediately
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const channel = new BroadcastChannel('local_db_updates');
          channel.postMessage({ entity: 'ChatMessage', action: 'create', id: createdMsg?.id, room_id: room?.id });
          channel.postMessage({ entity: 'ChatRoom', action: 'update', id: room?.id });
          channel.close();
        } catch (e) {
          console.error('BroadcastChannel send error:', e);
        }
      }

      setAttachedFile(null);
      setAttachedImage(null);
      await loadMessages();
      inputRef.current?.focus();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error?.message || "Pošiljanje sporočila ni uspelo.");
      setNewMessage(content);
    } finally {
      stopUploadStatus();
      setSending(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error(t(
          "Presegli ste velikost slike za posiljanje (10 MB).",
          "Image file size exceeds 10 MB limit."
        ));
        return;
      }
      setAttachedImage(file);
      setAttachedFile(null);
    } else if (file.type.startsWith("video/")) {
      if (file.size > MAX_VIDEO_SIZE) {
        toast.error(t(
          "Presegli ste velikost videoposnetka za posiljanje (20 MB).",
          "Video file size exceeds 20 MB limit."
        ));
        return;
      }
      getVideoDuration(file).then((duration) => {
        if (duration === null || Number.isNaN(duration)) {
          toast.error(t(
            "Videoposnetka ni bilo mogoce preveriti.",
            "Could not validate video duration."
          ));
          return;
        }
        if (duration > MAX_VIDEO_DURATION) {
          toast.error(t(
            "Dovoljeni so le videoposnetki do 1 minute.",
            "Only videos up to 1 minute are allowed."
          ));
        } else {
          setAttachedFile(file);
          setAttachedImage(null);
        }
      });
    } else {
      toast.error(t(
        "Dovoljene so le slike in videoposnetki do 1 minute.",
        "Only images and videos up to 1 minute are allowed."
      ));
    }
  };

  const startCamera = async (facingMode) => {
    setCameraMode(facingMode);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert("Napaka pri dostopu do kamere");
      setCameraMode(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], `camera_${Date.now()}.jpg`, { type: "image/jpeg" });
        setAttachedImage(file);
        stopCamera();
      }, "image/jpeg");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraMode(null);
  };

  const onEmojiClick = (emojiData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    // Update typing status only on transition to typing
    if (e.target.value.length > 0 && !isTyping) {
      setIsTyping(true);
      db.entities.ChatProfile.update(myProfileId, { is_typing: true }).catch(err => console.error("Error:", err));
    }
    
    // Clear and reset timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Clear typing status after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      db.entities.ChatProfile.update(myProfileId, { is_typing: false }).catch(err => console.error("Error:", err));
    }, 3000);
  };

  return (
    <div className={`flex flex-col h-full w-full sm:h-[600px] ${darkMode ? "bg-gray-800/50 border-gray-700" : "bg-gray-50/50 border-gray-100"} rounded-3xl border overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-4 ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100"} border-b`}>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-xl h-9 w-9"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {partnerName?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"} text-sm`}>{partnerName}</h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Circle className={`w-2 h-2 ${partnerOnline ? "fill-green-400 text-green-400" : "fill-gray-400 text-gray-400"}`} />
                <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  {partnerOnline ? "Na voljo" : "Offline"}
                </span>
                {partnerProfile && (
                  <>
                    <span className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>•</span>
                    {getAge(partnerProfile.birth_year) !== null && (
                      <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                        {getAge(partnerProfile.birth_year)} let
                      </span>
                    )}
                    {partnerProfile.country && (
                      <>
                        <span className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>•</span>
                        <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                          {partnerProfile.city ? `${partnerProfile.city}, ${partnerProfile.country}` : partnerProfile.country}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <div className={`text-center ${darkMode ? "text-gray-500" : "text-gray-400"} text-sm py-12`}>
            <p>Začni pogovor z {partnerName}! 💬</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.sender_profile_id === myProfileId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-md"
                      : darkMode
                      ? "bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-md shadow-sm"
                      : "bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm"
                  }`}
                >
                  {!isMe && (
                    <p className="text-xs font-medium text-violet-500 mb-1">{msg.sender_name}</p>
                  )}
                  {msg.content && <p className="break-words">{msg.content}</p>}
                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt="Slika"
                      className="mt-2 rounded-lg max-w-full h-auto max-h-64 object-cover cursor-pointer"
                      onClick={() => setPreviewImageUrl(msg.image_url)}
                    />
                  )}
                  {msg.file_url && (
                    <a
                      href={msg.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 mt-2 p-2 rounded-lg ${isMe ? "bg-white/10" : darkMode ? "bg-gray-700" : "bg-gray-50"}`}
                    >
                      <Paperclip className="w-4 h-4" />
                      <span className="text-xs truncate">{msg.file_name || "Datoteka"}</span>
                      <Download className="w-3 h-3 ml-auto" />
                    </a>
                  )}
                  <div className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-gray-400"} flex items-center gap-2`}>
                    <span>{new Date(msg.created_date).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" })}</span>
                    {isMe && (
                      <span className="flex items-center gap-1">
                        {partnerProfileId && normalizeReadBy(msg.read_by).includes(partnerProfileId) ? (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5 opacity-50" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {/* Typing Indicator */}
        {partnerIsTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex justify-start`}
          >
            <div className={`px-4 py-3 rounded-2xl rounded-bl-md ${darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"}`}>
              <div className="flex items-center gap-1.5">
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-gray-400"
                />
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  className="w-2 h-2 rounded-full bg-gray-400"
                />
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                  className="w-2 h-2 rounded-full bg-gray-400"
                />
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Camera View */}
      {cameraMode && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-black/50">
            <Button variant="ghost" size="icon" onClick={stopCamera} className="text-white">
              <X className="w-5 h-5" />
            </Button>
            <span className="text-white text-sm">{cameraMode === "user" ? "Sprednja kamera" : "Zadnja kamera"}</span>
            <div className="w-10" />
          </div>
          <video ref={videoRef} className="flex-1 object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="p-6 bg-black/50 flex justify-center">
            <Button
              onClick={capturePhoto}
              size="icon"
              className="h-16 w-16 rounded-full bg-white hover:bg-gray-200"
            >
              <Camera className="w-6 h-6 text-gray-900" />
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className={`px-4 py-3 ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100"} border-t`}>
        {(attachedFile || attachedImage) && (
          <div className="mb-2 flex items-center gap-2 p-2 bg-violet-50 rounded-lg">
            {attachedImage ? (
              <>
                <ImageIcon className="w-4 h-4 text-violet-600" />
                <span className="text-xs text-violet-900 flex-1 truncate">
                  {attachedImage.name}
                </span>
              </>
            ) : (
              <>
                <Paperclip className="w-4 h-4 text-violet-600" />
                <span className="text-xs text-violet-900 flex-1 truncate">
                  {attachedFile?.name}
                </span>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setAttachedFile(null);
                setAttachedImage(null);
              }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {sending && uploadStatus && (
          <div className={`mb-2 rounded-lg px-3 py-2 border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-violet-50 border-violet-100"}`}>
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
              <span className={`text-xs font-medium ${darkMode ? "text-gray-200" : "text-violet-900"} truncate`}>
                {t("Nalaganje datoteke...", "Uploading file...")} {uploadStatus.fileName}
              </span>
            </div>
            <p className={`text-[11px] mt-1 ${darkMode ? "text-gray-400" : "text-violet-700"}`}>
              {t("Preostali cas (ocena):", "Estimated time left:")} {Math.max(0, uploadStatus.estimatedTotalSec - uploadStatus.elapsedSec)}s
            </p>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,video/*"
          />
          
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 w-9 rounded-xl"
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => startCamera("environment")}
              className="h-9 w-9 rounded-xl"
            >
              <Camera className="w-4 h-4" />
            </Button>
          </div>

          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="h-9 w-9 rounded-xl"
            >
              <Smile className="w-4 h-4" />
            </Button>
            {showEmojiPicker && (
              <div className="absolute bottom-12 left-0 z-50">
                <EmojiPicker onEmojiClick={onEmojiClick} width={300} height={400} />
              </div>
            )}
          </div>

          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleTyping}
            placeholder="Napiši sporočilo..."
            className="flex-1 h-11 rounded-xl border-gray-200 focus:border-violet-400 focus:ring-violet-400/20"
            maxLength={500}
            autoFocus
          />
          <Button
            type="submit"
            disabled={(!newMessage.trim() && !attachedFile && !attachedImage) || sending}
            size="icon"
            className="h-11 w-11 rounded-xl bg-violet-600 text-white hover:bg-violet-700 focus:ring-2 focus:ring-violet-400"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>

      <Dialog
        open={Boolean(previewImageUrl)}
        onOpenChange={(open) => {
          if (!open) setPreviewImageUrl(null);
        }}
      >
        <DialogContent className={`${darkMode ? "bg-gray-900 border-gray-700" : "bg-white"} max-w-4xl p-2`}>
          {previewImageUrl && (
            <img
              src={previewImageUrl}
              alt="Povečana slika"
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
