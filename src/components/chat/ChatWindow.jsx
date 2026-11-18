import React, { useMemo, useState, useEffect, useRef } from "react";
import { db } from "@/api/db";
import { Paperclip, Camera, Smile, Download, Image as ImageIcon, Loader2, Ban, Flag, User } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { toast } from "sonner";
import { Avatar, ClassicDialog, ProfileDialog, getAge } from "@/components/chat/ClassicLayout";

// eslint-disable-next-line no-unused-vars
export default function ChatWindow({ room, myProfileId, myName, partnerName, onBack, onPartnerOffline, onUserBlocked, language = "sl", searchQuery = "" }) {
  const darkMode = document.documentElement.classList.contains("dark");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [attachedImage, setAttachedImage] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [cameraMode, setCameraMode] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [actionSending, setActionSending] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
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
  const t = (sl, en) => (language === "en" ? en : sl);
  const partnerImages = useMemo(() => {
    const avatar = partnerProfile?.avatar_url ? [partnerProfile.avatar_url] : [];
    const gallery = Array.isArray(partnerProfile?.gallery_images) ? partnerProfile.gallery_images.filter(Boolean) : [];
    return Array.from(new Set([...avatar, ...gallery]));
  }, [partnerProfile?.avatar_url, partnerProfile?.gallery_images]);

  const openPartnerProfileGallery = () => {
    if (!partnerProfile) return;
    setSelectedImageIndex(0);
    setShowProfileModal(true);
  };

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

  const handleReportUser = async () => {
    if (!reportReason.trim()) return;

    setActionSending(true);
    try {
      await db.entities.SupportMessage.create({
        sender_profile_id: myProfileId,
        sender_name: myName,
        subject: `${t("Prijava uporabnika", "Report user")}: ${partnerName}`,
        message: reportReason.trim(),
        type: "tezava",
      });
      setShowReport(false);
      setReportReason("");
      toast.success(t("Prijava poslana.", "Report sent."));
    } catch (error) {
      console.error("Report user error:", error);
      toast.error(error?.message || t("Napaka pri posiljanju prijave.", "Error sending report."));
    } finally {
      setActionSending(false);
    }
  };

  const handleBlockUser = async () => {
    if (!partnerProfileId) return;

    setActionSending(true);
    try {
      const mine = await db.entities.ChatProfile.filter({ id: myProfileId });
      const current = mine?.[0] || null;
      if (!current) throw new Error(t("Profila ni mogoce naloziti.", "Could not load your profile."));

      const blockedUsers = Array.isArray(current.blocked_users) ? current.blocked_users : [];
      if (!blockedUsers.includes(partnerProfileId)) {
        await db.entities.ChatProfile.update(myProfileId, {
          blocked_users: [...blockedUsers, partnerProfileId],
        });
      }

      setShowBlock(false);
      toast.success(t("Uporabnik je blokiran.", "User has been blocked."));
      if (typeof onUserBlocked === "function") onUserBlocked(partnerProfileId);
      if (typeof onBack === "function") onBack();
    } catch (error) {
      console.error("Block user error:", error);
      toast.error(error?.message || t("Napaka pri blokiranju.", "Error blocking user."));
    } finally {
      setActionSending(false);
    }
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
    const typingInterval = setInterval(checkTypingStatus, 1500);

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
    setNewMessage("");

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

  const q = String(searchQuery || "").trim().toLocaleLowerCase("sl");
  const shownMessages = q
    ? messages.filter((m) => String(m.content || "").toLocaleLowerCase("sl").includes(q) || String(m.file_name || "").toLocaleLowerCase("sl").includes(q))
    : messages;
  const age = partnerProfile ? getAge(partnerProfile.birth_year) : null;
  const place = partnerProfile ? [partnerProfile.city, partnerProfile.country].filter(Boolean).join(", ") : "";
  const lang = language === "en" ? "en-GB" : "sl-SI";

  return (
    <>
      {/* Glava pogovora */}
      <div className="k-phead">
        <button type="button" onClick={openPartnerProfileGallery} className="k-avatar-sm" aria-label={t("Ogled profila", "View profile")} title={t("Ogled profila", "View profile")} style={{ background: "transparent" }}>
          <Avatar profile={partnerProfile || { display_name: partnerName }} className="k-avatar-sm" />
        </button>
        <span className={`k-dot${partnerOnline ? "" : " k-away"}`} aria-hidden="true" />
        <b>{partnerName}</b>
        <span className="k-meta">
          · {partnerOnline ? t("Na voljo", "Available") : t("Ni na voljo", "Offline")}
          {age !== null && ` · ${age} ${t("let", "y")}`}
          {place && ` · ${place}`}
        </span>
        <span className="k-acts">
          <button type="button" className="k-tb" onClick={openPartnerProfileGallery} aria-label={t("Profil", "Profile")}>
            <User aria-hidden="true" /><span className="k-lbl-hide">{t("Profil", "Profile")}</span>
          </button>
          <button type="button" className="k-tb" onClick={() => setShowReport(true)} aria-label={t("Prijavi", "Report")}>
            <Flag aria-hidden="true" /><span className="k-lbl-hide">{t("Prijavi", "Report")}</span>
          </button>
          <button type="button" className="k-tb k-danger" onClick={() => setShowBlock(true)} aria-label={t("Blokiraj", "Block")}>
            <Ban aria-hidden="true" /><span className="k-lbl-hide">{t("Blokiraj", "Block")}</span>
          </button>
        </span>
      </div>

      {/* Sporočila */}
      <div className="k-log chat-scroll" role="log" aria-label={t("Sporočila", "Messages")}>
        {shownMessages.length === 0 && (
          <p className="k-empty-msg">{q ? t("Ni zadetkov.", "No matches.") : `${t("Začni pogovor z", "Start a chat with")} ${partnerName}.`}</p>
        )}
        {shownMessages.map((msg) => {
          const isMe = msg.sender_profile_id === myProfileId;
          const read = isMe && partnerProfileId && normalizeReadBy(msg.read_by).includes(partnerProfileId);
          return (
            <div key={msg.id} className={`k-msg${isMe ? " k-me" : ""}`}>
              <time className="k-t" dateTime={msg.created_date}>
                {new Date(msg.created_date).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}
              </time>
              <span className="k-n" title={msg.sender_name}>{isMe ? myName : msg.sender_name || partnerName}</span>
              <div className="k-m">
                {msg.content}
                {msg.image_url && (
                  <button type="button" onClick={() => setPreviewImageUrl(msg.image_url)} style={{ display: "block", padding: 0, border: 0, background: "none" }} aria-label={t("Povečaj sliko", "Enlarge image")}>
                    <img src={msg.image_url} alt={t("Slika", "Image")} className="k-att-img" />
                  </button>
                )}
                {msg.file_url && (
                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="k-att">
                    <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="k-ell">{msg.file_name || t("Datoteka", "File")}</span>
                    <Download className="w-3 h-3" aria-hidden="true" />
                  </a>
                )}
                {isMe && <span className={`k-read${read ? " k-yes" : ""}`} title={read ? t("Prebrano", "Read") : t("Poslano", "Sent")}>{read ? "✓✓" : "✓"}</span>}
              </div>
            </div>
          );
        })}
        {partnerIsTyping && <div className="k-typing">{partnerName} {t("piše …", "is typing …")}</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Kamera */}
      {cameraMode && (
        <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 60, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, color: "#fff" }}>
            <button type="button" className="k-btn" onClick={stopCamera}>{t("Zapri", "Close")}</button>
            <span>{cameraMode === "user" ? t("Sprednja kamera", "Front camera") : t("Zadnja kamera", "Back camera")}</span>
            <span style={{ width: 60 }} />
          </div>
          <video ref={videoRef} style={{ flex: 1, objectFit: "cover", minHeight: 0 }} />
          <canvas ref={canvasRef} className="hidden" />
          <div style={{ padding: 20, display: "flex", justifyContent: "center" }}>
            <button type="button" className="k-btn k-pri" onClick={capturePhoto} aria-label={t("Zajemi fotografijo", "Take photo")}>
              <Camera className="w-5 h-5" aria-hidden="true" /> {t("Zajemi", "Capture")}
            </button>
          </div>
        </div>
      )}

      {/* Vnos */}
      <form onSubmit={handleSend} className={`k-compose${attachedFile || attachedImage || (sending && uploadStatus) ? " k-tall" : ""}`}>
        {(attachedFile || attachedImage) && (
          <div className="k-attached">
            {attachedImage ? <ImageIcon className="w-4 h-4" aria-hidden="true" /> : <Paperclip className="w-4 h-4" aria-hidden="true" />}
            <span>{attachedImage ? attachedImage.name : attachedFile?.name}</span>
            <button type="button" className="k-ed" aria-label={t("Odstrani priponko", "Remove attachment")} onClick={() => { setAttachedFile(null); setAttachedImage(null); }}>✕</button>
          </div>
        )}
        {sending && uploadStatus && (
          <div className="k-attached" role="status">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            <span>
              {t("Nalaganje datoteke …", "Uploading file …")} {uploadStatus.fileName} · {t("še približno", "about")} {Math.max(0, uploadStatus.estimatedTotalSec - uploadStatus.elapsedSec)} s
            </span>
          </div>
        )}
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept="image/*,video/*" />
        <button type="button" className="k-ib" onClick={() => fileInputRef.current?.click()} aria-label={t("Dodaj datoteko", "Attach file")} title={t("Dodaj datoteko", "Attach file")}>
          <Paperclip aria-hidden="true" />
        </button>
        <button type="button" className="k-ib" onClick={() => startCamera("environment")} aria-label={t("Odpri kamero", "Open camera")} title={t("Odpri kamero", "Open camera")}>
          <Camera aria-hidden="true" />
        </button>
        <button type="button" className="k-ib" onClick={() => setShowEmojiPicker(!showEmojiPicker)} aria-label={t("Odpri emoji", "Open emoji picker")} aria-expanded={showEmojiPicker} title="Emoji">
          <Smile aria-hidden="true" />
        </button>
        {showEmojiPicker && (
          <div className="k-emoji-pop">
            <EmojiPicker onEmojiClick={onEmojiClick} width={300} height={380} theme={darkMode ? "dark" : "light"} />
          </div>
        )}
        <input
          ref={inputRef}
          value={newMessage}
          onChange={handleTyping}
          placeholder={t("Napiši sporočilo … (Enter pošlje)", "Write a message … (Enter sends)")}
          aria-label={t("Sporočilo", "Message")}
          className="k-inp"
          maxLength={500}
          autoFocus
        />
        <button type="submit" className="k-btn k-pri" disabled={(!newMessage.trim() && !attachedFile && !attachedImage) || sending}>
          {t("Pošlji", "Send")}
        </button>
      </form>

      {/* Povečana slika */}
      <ClassicDialog open={Boolean(previewImageUrl)} onOpenChange={(open) => !open && setPreviewImageUrl(null)} title={t("Slika", "Image")} wide>
        {previewImageUrl && <img src={previewImageUrl} alt={t("Povečana slika", "Enlarged image")} className="k-photo" style={{ maxHeight: "75vh" }} />}
      </ClassicDialog>

      {/* Profil sogovornika */}
      {showProfileModal && partnerProfile && (
        <ProfileDialog
          sl={language !== "en"}
          profile={partnerProfile}
          online={partnerOnline}
          onClose={() => setShowProfileModal(false)}
          onChat={() => setShowProfileModal(false)}
        />
      )}

      {/* Prijava */}
      <ClassicDialog
        open={showReport}
        onOpenChange={setShowReport}
        title={`${t("Prijava uporabnika", "Report user")} ${partnerName}`}
        footer={
          <>
            <button type="button" className="k-btn" onClick={() => setShowReport(false)}>{t("Prekliči", "Cancel")}</button>
            <button type="button" className="k-btn k-pri" onClick={handleReportUser} disabled={!reportReason.trim() || actionSending}>
              {actionSending ? t("Pošiljam …", "Sending …") : t("Pošlji prijavo", "Send report")}
            </button>
          </>
        }
      >
        <div className="k-field">
          <label htmlFor="report-reason">{t("Razlog prijave", "Reason for report")}</label>
          <textarea id="report-reason" className="k-inp" value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder={t("Opiši problem …", "Describe the issue …")} rows={4} maxLength={500} />
        </div>
      </ClassicDialog>

      {/* Blokiranje */}
      <ClassicDialog
        open={showBlock}
        onOpenChange={setShowBlock}
        title={`${t("Blokiraj uporabnika?", "Block user?")} ${partnerName}`}
        footer={
          <>
            <button type="button" className="k-btn" onClick={() => setShowBlock(false)}>{t("Prekliči", "Cancel")}</button>
            <button type="button" className="k-btn k-red" onClick={handleBlockUser} disabled={actionSending}>
              {actionSending ? t("Blokiram …", "Blocking …") : t("Blokiraj", "Block")}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {t(
            "Blokiran uporabnik te ne bo mogel kontaktirati in ga ne boš več videl na seznamu.",
            "Blocked user won't be able to contact you and you won't see them in the list anymore."
          )}
        </p>
      </ClassicDialog>
    </>
  );
}
