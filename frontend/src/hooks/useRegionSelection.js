import { useState, useRef, useCallback } from 'react';

export default function useRegionSelection() {
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });
  const [cropRegion, setCropRegion] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  
  const selectionRef = useRef(null);
  const videoContainerRef = useRef(null);

  // Handler for starting selection - utilisant useCallback pour éviter des re-renders inutiles
  const handleMouseDown = useCallback((e) => {
    if (!isSelectingRegion || !videoContainerRef.current) return;
    
    const rect = videoContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
    setIsDragging(true);
    setHasSelection(false);
    e.preventDefault();
  }, [isSelectingRegion]);

  // Handler for dragging selection
  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !videoContainerRef.current) return;
    
    const rect = videoContainerRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
    const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height);
    
    setSelectionEnd({ x, y });
    e.preventDefault();
  }, [isDragging]);

  // Handler for completing selection
  const handleMouseUp = useCallback((e) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // Only set hasSelection if we have a meaningful selection (width/height > 10px)
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    
    if (width > 10 && height > 10) {
      setHasSelection(true);
      // Show popup modal when selection is completed
      setShowSelectionModal(true);
    } else {
      // Reset the selection if it's too small
      setSelectionStart({ x: 0, y: 0 });
      setSelectionEnd({ x: 0, y: 0 });
    }
    
    e.preventDefault();
  }, [isDragging, selectionEnd, selectionStart]);

  // Confirm selected region
  const confirmRegionSelection = useCallback(() => {
    // Ensure proper order of coordinates
    const left = Math.min(selectionStart.x, selectionEnd.x);
    const top = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    
    // Only set crop if we have a meaningful selection and the container exists
    if (width > 20 && height > 20 && videoContainerRef.current) {
      // Get container dimensions for relative calculations
      const containerRect = videoContainerRef.current.getBoundingClientRect();
      
      // Make sure we have valid dimensions
      if (containerRect.width <= 0 || containerRect.height <= 0) {
        console.error("Invalid container dimensions", containerRect);
        setIsSelectingRegion(false);
        setShowSelectionModal(false);
        return;
      }
      
      // Calculate relative dimensions (0-1 range)
      const newCropRegion = {
        left: left / containerRect.width,
        top: top / containerRect.height,
        width: width / containerRect.width,
        height: height / containerRect.height
      };
      
      // Validate crop region values
      if (
        isNaN(newCropRegion.left) || 
        isNaN(newCropRegion.top) || 
        isNaN(newCropRegion.width) || 
        isNaN(newCropRegion.height) ||
        newCropRegion.width <= 0 ||
        newCropRegion.height <= 0
      ) {
        console.error("Invalid crop region values", newCropRegion);
        setIsSelectingRegion(false);
        setShowSelectionModal(false);
        return;
      }
      
      console.log("Setting crop region:", newCropRegion);
      setCropRegion(newCropRegion);
    }
    
    setIsSelectingRegion(false);
    setIsDragging(false);
    setHasSelection(false);
    setShowSelectionModal(false); // Hide modal after confirmation
  }, [selectionStart, selectionEnd]);

  // Cancel region selection
  const cancelRegionSelection = useCallback(() => {
    setIsSelectingRegion(false);
    setIsDragging(false);
    setHasSelection(false);
    setShowSelectionModal(false); // Hide modal after cancellation
    setSelectionStart({ x: 0, y: 0 });
    setSelectionEnd({ x: 0, y: 0 });
  }, []);

  // Reset crop to show full screen
  const resetCrop = useCallback(() => {
    setCropRegion(null);
  }, []);

  // Calculate selection rectangle dimensions
  const getSelectionStyle = useCallback(() => {
    if (!isDragging) return {};
    
    const left = Math.min(selectionStart.x, selectionEnd.x);
    const top = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  }, [isDragging, selectionStart, selectionEnd]);

  // Calculate video crop style
  const getVideoCropStyle = useCallback(() => {
    if (!cropRegion) return {};
    
    // Valider les données avant d'appliquer
    if (
      cropRegion.width <= 0 || 
      cropRegion.height <= 0 ||
      isNaN(cropRegion.left) ||
      isNaN(cropRegion.top) ||
      isNaN(cropRegion.width) ||
      isNaN(cropRegion.height)
    ) {
      console.error("Invalid crop region in getVideoCropStyle", cropRegion);
      return {};
    }
    
    return {
      position: 'absolute',
      left: `-${cropRegion.left * 100}%`,
      top: `-${cropRegion.top * 100}%`,
      width: `${100 / cropRegion.width}%`,
      height: `${100 / cropRegion.height}%`,
    };
  }, [cropRegion]);
  
  // Start the region selection process
  const startRegionSelection = useCallback(() => {
    // Reset any existing selection
    setSelectionStart({ x: 0, y: 0 });
    setSelectionEnd({ x: 0, y: 0 });
    setHasSelection(false);
    setIsDragging(false);
    setShowSelectionModal(false);
    
    // Start selection mode
    setIsSelectingRegion(true);
  }, []);

  return {
    isSelectingRegion,
    selectionStart,
    selectionEnd,
    cropRegion,
    isDragging,
    hasSelection,
    showSelectionModal,
    selectionRef,
    videoContainerRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    confirmRegionSelection,
    cancelRegionSelection,
    resetCrop,
    getSelectionStyle,
    getVideoCropStyle,
    startRegionSelection
  };
} 