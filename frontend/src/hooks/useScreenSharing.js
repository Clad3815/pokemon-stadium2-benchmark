import { useState, useRef, useEffect } from 'react';

export default function useScreenSharing() {
  const [isSharing, setIsSharing] = useState(false);
  const [sharingError, setSharingError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  // Clean up function for screen sharing
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const startScreenShare = async () => {
    try {
      setSharingError(null);
      
      // Arrêter tout stream existant d'abord
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Request screen sharing with appropriate constraints
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "window",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      // Si aucune piste vidéo n'est disponible, lever une erreur
      if (!stream.getVideoTracks().length) {
        throw new Error("No video track available in the stream");
      }
      
      // Store stream reference for cleanup
      streamRef.current = stream;
      
      // Set isSharing early to make sure video element is rendered
      setIsSharing(true);
      
      // Nous utilisons un timeout pour s'assurer que l'élément vidéo est dans le DOM
      setTimeout(() => {
        if (videoRef.current) {
          const videoElement = videoRef.current;
          
          // Nettoyer d'abord les gestionnaires d'événements existants
          videoElement.onloadedmetadata = null;
          videoElement.oncanplay = null;
          videoElement.onplay = null;
          videoElement.onerror = null;
          
          // Supprimer les sources existantes
          videoElement.srcObject = null;
          videoElement.src = "";
          
          // Basic setup
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          videoElement.muted = true;
          
          // Fonction pour tenter la lecture
          const attemptPlayback = function() {
            if (videoElement.paused) {
              videoElement.play().catch(e => console.warn("Play attempt failed:", e));
            }
          };
          
          // Gestionnaires d'événements
          const playHandler = function() {
            console.log("Video play event triggered");
          };
          
          const errorHandler = function(e) {
            console.error("Video error:", e);
            setSharingError(`Video error: ${e.message || "Unknown error"}`);
          };
          
          // Configurer les gestionnaires d'événements
          videoElement.onloadedmetadata = attemptPlayback;
          videoElement.oncanplay = attemptPlayback;
          videoElement.onplay = playHandler;
          videoElement.onerror = errorHandler;
          
          // Appliquer le stream
          videoElement.srcObject = stream;
          
          // Forcer la lecture initiale avec plusieurs tentatives
          attemptPlayback();
          
          // Tentatives supplémentaires avec des délais croissants
          setTimeout(attemptPlayback, 100);
          setTimeout(attemptPlayback, 500);
          setTimeout(attemptPlayback, 1000);
          
          // Force layout update and redraw to ensure video is visible
          videoElement.style.display = 'none';
          // Force a reflow
          videoElement.offsetHeight;
          videoElement.style.display = 'block';
          
          // Surveillance supplémentaire des dimensions réelles de la vidéo
          let checkCount = 0;
          const maxChecks = 30; // Limite de tentatives (environ 3 secondes)
          
          const checkVideo = function() {
            if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
              console.log("Video dimensions available:", videoElement.videoWidth, "x", videoElement.videoHeight);
            } else {
              checkCount++;
              if (checkCount < maxChecks) {
                // Continuer à vérifier
                requestAnimationFrame(checkVideo);
              } else {
                // Trop de tentatives sans succès
                console.warn("Failed to get video dimensions after multiple attempts");
              }
            }
          };
          
          requestAnimationFrame(checkVideo);
        }
      }, 100); // Donner à React le temps de rendre l'élément vidéo
      
      // Gérer la fin du stream (utilisateur arrête le partage)
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.onended = () => {
        stopScreenShare();
      };
      
      return true;
    } catch (error) {
      console.error("Error starting screen share:", error);
      setSharingError(`Failed to start screen sharing: ${error.message || "Please make sure you've granted the necessary permissions."}`);
      stopScreenShare(); // Nettoyer en cas d'erreur
      return false;
    }
  };

  const stopScreenShare = () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      const videoElement = videoRef.current;
      videoElement.onloadedmetadata = null;
      videoElement.oncanplay = null;
      videoElement.onplay = null;
      videoElement.onerror = null;
      videoElement.srcObject = null;
      videoElement.src = "";
      videoElement.load();
    }
    
    setIsSharing(false);
  };

  return {
    isSharing,
    sharingError,
    videoRef,
    streamRef,
    startScreenShare,
    stopScreenShare
  };
} 