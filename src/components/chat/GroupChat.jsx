import React, { useState, useEffect, useRef } from "react";
import { db } from "@/api/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, Users, Image as ImageIcon, X, Camera, Smile, Check, CheckCheck } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import GroupMembers from "./GroupMembers";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function GroupChat({ group, myProfileId, myName, onBack, language = "sl" }) {
  const darkMode = document.documentElement.classList.contains("dark");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [someoneIsTyping, setSomeoneIsTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    
    // Poll group members' typing status every 10 seconds
    const checkTypingStatus = async () => {
      try {
        const otherMembers = group.member_ids?.filter(id => id !== myProfileId) || [];
        if (otherMembers.length > 0) {
          const typingMembers = await db.entities.ChatProfile.filter({ is_typing: true });
          const isAnyoneTyping = typingMembers.some(p => otherMembers.includes(p.id));
          setSomeoneIsTyping(isAnyoneTyping);
        }
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
  }, [group.id, myProfileId]);

  // Mark messages as read when viewing
  useEffect(() => {
    const markAsRead = async () => {
      const unreadMessages = messages.filter(
        msg => msg.sender_profile_id !== myProfileId && 
        (!msg.read_by || !msg.read_by.includes(myProfileId))
      );
      
      for (const msg of unreadMessages) {
        const updatedReadBy = [...(msg.read_by || []), myProfileId];
        await db.entities.GroupMessage.update(msg.id, {
          read_by: updatedReadBy,
          read_at: new Date().toISOString()
        });
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
    const msgs = await db.entities.GroupMessage.filter(
      { group_id: group.id },
      "created_date",
      100
    );
    setMessages(msgs);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachedImage) || sending) return;

    const content = newMessage.trim();
    setSending(true);
    setNewMessage("");

    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    db.entities.ChatProfile.update(myProfileId, { is_typing: false }).catch((err) => console.error("Error:", err));

    const messageData = {
      group_id: group.id,
      sender_profile_id: myProfileId,
      sender_name: myName,
      content: content || "",
    };

    try {
      if (attachedImage) {
        const { file_url } = await db.integrations.Core.UploadFile({ file: attachedImage });
        messageData.image_url = file_url;
      }

      await db.entities.GroupMessage.create(messageData);
      await db.entities.ChatGroup.update(group.id, {
        last_message: content || (messageData.image_url ? "[image]" : ""),
        status: "active",
        inactive_since: null,
      });
      setAttachedImage(null);
      await loadMessages();
      inputRef.current?.focus();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error?.message || "Pošiljanje sporočila ni uspelo.");
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setAttachedImage(file);
    }
  };

  const onEmojiClick = (emojiData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
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

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Camera error:", error);
      setShowCamera(false);
      alert("Ne morem dostopati do kamere");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
        setAttachedImage(file);
        closeCamera();
      }
    }, "image/jpeg");
  };

  const closeCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  return (
    <div className={`flex flex-col h-full ${darkMode ? "bg-gray-800/50 border-gray-700" : "bg-gray-50/50 border-gray-100"} rounded-3xl border overflow-hidden`}>
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
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: group.avatar_color || "#8b5cf6" }}
            >
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"} text-sm`}>{group.name}</h3>
              <GroupMembers group={group} language={language} />
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-scroll flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <div className={`text-center ${darkMode ? "text-gray-500" : "text-gray-400"} text-sm py-12`}>
            <p>Začni pogovor v skupini! 💬</p>
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
                  <div className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-gray-400"} flex items-center gap-2`}>
                    <span>{new Date(msg.created_date).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" })}</span>
                    {isMe && (
                      <span className="flex items-center gap-1">
                        {msg.read_by && msg.read_by.some(id => id !== myProfileId) ? (
                          <>
                            <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-blue-400 text-[9px]">
                              {msg.read_by.filter(id => id !== myProfileId).length}
                            </span>
                          </>
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
        {someoneIsTyping && (
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

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-xl"
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
              <Button
                onClick={closeCamera}
                variant="outline"
                className="rounded-full h-12 w-12 bg-white/20 backdrop-blur border-white/30"
              >
                <X className="w-5 h-5 text-white" />
              </Button>
              <Button
                onClick={capturePhoto}
                className="rounded-full h-14 w-14 bg-white hover:bg-gray-100"
              >
                <Camera className="w-6 h-6 text-gray-900" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className={`px-4 py-3 ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100"} border-t relative`}>
        {showEmojiPicker && (
          <div className="absolute bottom-full right-4 mb-2 z-10">
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              theme={darkMode ? "dark" : "light"}
              width={320}
              height={400}
            />
          </div>
        )}

        {attachedImage && (
          <div className={`mb-2 flex items-center gap-2 p-2 rounded-lg ${darkMode ? "bg-violet-900/20" : "bg-violet-50"}`}>
            <ImageIcon className="w-4 h-4 text-violet-600" />
            <span className={`text-xs flex-1 truncate ${darkMode ? "text-violet-300" : "text-violet-900"}`}>{attachedImage.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setAttachedImage(null)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleImageUpload}
            accept="image/*"
          />
          
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 w-9 rounded-xl shrink-0"
          >
            <ImageIcon className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={startCamera}
            className="h-9 w-9 rounded-xl shrink-0"
          >
            <Camera className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="h-9 w-9 rounded-xl shrink-0"
          >
            <Smile className="w-4 h-4" />
          </Button>

          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleTyping}
            placeholder="Napiši sporočilo..."
            className={`flex-1 h-11 rounded-xl focus:border-violet-400 focus:ring-violet-400/20 ${darkMode ? "bg-gray-800 border-gray-700 text-white" : "border-gray-200"}`}
            maxLength={500}
            autoFocus
          />
          <Button
            type="submit"
            disabled={(!newMessage.trim() && !attachedImage) || sending}
            size="icon"
            className="h-11 w-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200/50 shrink-0"
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
