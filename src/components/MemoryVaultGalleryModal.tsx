import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  KeyRound, Download, Folder, Trash2, FolderPlus, Heart, Image as ImageIcon, Video 
} from 'lucide-react';
import { vaultService, VaultItem, VaultFolder } from '../services/vaultService';
import { vaultStorageNative } from '../services/vaultStorageNative';
import { VaultPhotoViewer } from './VaultPhotoViewer';

interface MemoryVaultGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VaultItemTile: React.FC<{
  item: VaultItem;
  globalIdx: number;
  isSelected: boolean;
  isSelectMode: boolean;
  onItemClick: (item: VaultItem, globalIdx: number) => void;
  onTouchStart: (e: React.TouchEvent, itemId: string) => void;
  onTouchEnd: () => void;
  onMouseDown: (e: React.MouseEvent, itemId: string) => void;
}> = ({
  item,
  globalIdx,
  isSelected,
  isSelectMode,
  onItemClick,
  onTouchStart,
  onTouchEnd,
  onMouseDown,
}) => {
  const [mediaSrc, setMediaSrc] = useState<string>(item.dataUrl || '');

  useEffect(() => {
    let isMounted = true;
    if (!item.dataUrl) {
      vaultService.ensureDecryptedDataUrl(item).then((url) => {
        if (isMounted && url) {
          setMediaSrc(url);
        }
      });
    } else {
      setMediaSrc(item.dataUrl);
    }
    return () => {
      isMounted = false;
    };
  }, [item.id, item.dataUrl]);

  return (
    <div
      onTouchStart={(e) => onTouchStart(e, item.id)}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchEnd}
      onMouseDown={(e) => onMouseDown(e, item.id)}
      onMouseUp={onTouchEnd}
      onMouseLeave={onTouchEnd}
      onClick={() => onItemClick(item, globalIdx)}
      className={`group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border cursor-pointer shadow transition-all duration-300 ${
        isSelected
          ? 'border-indigo-400 ring-2 ring-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]'
          : 'border-white/10 hover:border-indigo-400/40 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]'
      }`}
    >
      {item.type === 'video' ? (
        <div className="w-full h-full relative flex items-center justify-center bg-black">
          {mediaSrc ? (
            mediaSrc.startsWith('data:image') ? (
              <img src={mediaSrc} alt={item.name} className="w-full h-full object-cover opacity-85" />
            ) : (
              <video src={mediaSrc} className="w-full h-full object-cover opacity-85" preload="metadata" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-950">
              <span className="text-[10px] text-slate-500 font-mono">VIDEO</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="px-2 py-0.5 rounded-full bg-indigo-600/90 text-white text-[10px] font-medium shadow tracking-wider">
              VIDEO
            </div>
          </div>
        </div>
      ) : mediaSrc ? (
        <img
          src={mediaSrc}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-950 animate-pulse">
          <span className="text-[10px] text-slate-500 font-mono">PHOTO</span>
        </div>
      )}

      {/* Selection Checkbox */}
      {(isSelectMode || isSelected) && (
        <div className="absolute top-1.5 left-1.5 z-10">
          <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold ${
            isSelected ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black/50 border-white/60 text-transparent'
          }`}>
            {isSelected ? '✓' : ''}
          </div>
        </div>
      )}
    </div>
  );
};


export const MemoryVaultGalleryModal: React.FC<MemoryVaultGalleryModalProps> = ({ isOpen, onClose }) => {
  const [hasPass, setHasPass] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  
  // Auth Form States
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [recoveryQuestion, setRecoveryQuestion] = useState<string>('What is our special date or memorable keyword?');
  const [recoveryAnswer, setRecoveryAnswer] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Forgot Password Flow States
  const [authView, setAuthView] = useState<'unlock' | 'create' | 'forgot'>('unlock');
  const [forgotAnswerInput, setForgotAnswerInput] = useState<string>('');
  const [newResetPassword, setNewResetPassword] = useState<string>('');
  const [isRecoveryVerified, setIsRecoveryVerified] = useState<boolean>(false);

  // Gallery Navigation & State
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null); // null = All items
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);

  // Gallery Views ('grid' | 'settings')
  const [gallerySubView, setGallerySubView] = useState<'grid' | 'settings'>('grid');

  // Selection & Batch Action States
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Modals inside Gallery ('new-folder' | 'rename-folder' | 'move-items' | 'copy-items' | 'rename-item' | 'confirm-delete' | 'confirm-delete-single')
  const [modalAction, setModalAction] = useState<string | null>(null);
  const [modalInputVal, setModalInputVal] = useState<string>('');
  const [targetItemForModal, setTargetItemForModal] = useState<VaultItem | null>(null);

  // Full-screen Media Viewer State
  const [viewerItemIndex, setViewerItemIndex] = useState<number | null>(null);

  // Settings Form States
  const [oldPassInput, setOldPassInput] = useState<string>('');
  const [newPassInput, setNewPassInput] = useState<string>('');
  const [backupPassInput, setBackupPassInput] = useState<string>('');
  const [restoreFileContent, setRestoreFileContent] = useState<string | null>(null);
  const [restorePassInput, setRestorePassInput] = useState<string>('');

  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef<boolean>(false);
  const isTouchDeviceRef = useRef<boolean>(false);

  // -------------------------------------------------------------------------
  // INITIALIZATION & SUBSCRIPTION
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    checkPasswordStatus();
    const unsubscribe = vaultService.subscribe((unlocked) => {
      setIsUnlocked(unlocked);
      if (unlocked) {
        refreshData();
      } else {
        setItems([]);
        setFolders([]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  const checkPasswordStatus = async () => {
    const exists = await vaultService.hasPassword();
    setHasPass(exists);
    let currentlyUnlocked = vaultService.getUnlockedStatus();
    if (!currentlyUnlocked) {
      currentlyUnlocked = await vaultService.tryRestoreSession();
    }
    setIsUnlocked(currentlyUnlocked);
    if (!exists) {
      setAuthView('create');
    } else {
      setAuthView('unlock');
    }
    if (currentlyUnlocked) {
      refreshData();
    }
  };

  const refreshData = () => {
    setItems([...vaultService.getVaultItems()]);
    setFolders([...vaultService.getFolders()]);
  };

  // -------------------------------------------------------------------------
  // BACK NAVIGATION HANDLING (Android Back Gesture / Button / Esc)
  // -------------------------------------------------------------------------
  const handleBackNavigation = useCallback(() => {
    if (!isUnlocked) {
      onClose();
      return;
    }
    if (viewerItemIndex !== null) {
      setViewerItemIndex(null);
      return;
    }
    if (modalAction !== null) {
      setModalAction(null);
      setModalInputVal('');
      return;
    }
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedItemIds([]);
      return;
    }
    if (gallerySubView === 'settings') {
      setGallerySubView('grid');
      return;
    }
    if (showSearch) {
      setShowSearch(false);
      setSearchQuery('');
      return;
    }
    if (activeFolderId !== null) {
      setActiveFolderId(null);
      return;
    }
    onClose();
  }, [isUnlocked, viewerItemIndex, modalAction, isSelectMode, gallerySubView, showSearch, activeFolderId, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBackNavigation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleBackNavigation]);

  // -------------------------------------------------------------------------
  // AUTHENTICATION HANDLERS
  // -------------------------------------------------------------------------
  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!passwordInput || passwordInput.length < 4) {
      setErrorMsg('Password must be at least 4 characters.');
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!recoveryAnswer.trim()) {
      setErrorMsg('Recovery answer is required.');
      return;
    }

    const success = await vaultService.createPassword(passwordInput, recoveryQuestion, recoveryAnswer);
    if (success) {
      setPasswordInput('');
      setConfirmPasswordInput('');
      setRecoveryAnswer('');
      setHasPass(true);
      setIsUnlocked(true);
      refreshData();
    } else {
      setErrorMsg('Failed to create password.');
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!passwordInput) {
      setErrorMsg('Please enter password.');
      return;
    }
    const success = await vaultService.verifyPassword(passwordInput);
    if (success) {
      setPasswordInput('');
      setIsUnlocked(true);
      refreshData();
    } else {
      setErrorMsg('Incorrect password.');
    }
  };

  const handleVerifyForgotRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!forgotAnswerInput.trim()) {
      setErrorMsg('Please enter your recovery answer.');
      return;
    }
    const isValid = await vaultService.verifyRecovery(forgotAnswerInput);
    if (isValid) {
      setIsRecoveryVerified(true);
      setErrorMsg('');
    } else {
      setErrorMsg('Incorrect recovery answer.');
    }
  };

  const handleResetPasswordAfterRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newResetPassword || newResetPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters.');
      return;
    }
    const success = await vaultService.resetPasswordWithRecovery(forgotAnswerInput, newResetPassword);
    if (success) {
      setForgotAnswerInput('');
      setNewResetPassword('');
      setIsRecoveryVerified(false);
      setAuthView('unlock');
      setIsUnlocked(true);
      refreshData();
    } else {
      setErrorMsg('Password reset failed.');
    }
  };

  const handleLockVault = () => {
    vaultService.lockVault();
    setIsUnlocked(false);
    setPasswordInput('');
    setViewerItemIndex(null);
    setActiveFolderId(null);
    setIsSelectMode(false);
    setSelectedItemIds([]);
    setGallerySubView('grid');
    setShowSearch(false);
  };

  // -------------------------------------------------------------------------
  // MEDIA IMPORT & ENCRYPTION HANDLERS
  // -------------------------------------------------------------------------
  const handleAddMediaClick = async (preferredType: 'image' | 'video' | 'all' = 'all') => {
    setErrorMsg('');

    if (vaultStorageNative.isNative()) {
      setIsEncrypting(true);
      try {
        const res = await vaultStorageNative.pickMediaFiles({ mediaType: preferredType });

        if (res.cancelled) {
          // User closed/cancelled the picker. Stay on the current vault screen cleanly.
          return;
        }

        if (res.error) {
          setErrorMsg(res.error);
          return;
        }

        if (res.items && res.items.length > 0) {
          const success = await vaultService.registerNativeImportedItems(
            res.items,
            activeFolderId === 'root' ? undefined : activeFolderId || undefined
          );

          if (success) {
            refreshData();
          } else {
            setErrorMsg('Failed to save imported media to Vault database.');
          }
        } else {
          setErrorMsg('No photos or videos could be added. Please select valid media files.');
        }
      } catch (err: any) {
        console.error('Vault native media import error:', err);
        setErrorMsg(err.message || 'Error importing media into Vault.');
      } finally {
        setIsEncrypting(false);
      }
      return;
    }

    // Web Fallback (Standard File Picker for desktop/browser only)
    if (fileInputRef.current) {
      if (preferredType === 'image') fileInputRef.current.accept = 'image/*';
      else if (preferredType === 'video') fileInputRef.current.accept = 'video/*';
      else fileInputRef.current.accept = 'image/*,video/*,application/*,text/*';
      fileInputRef.current.click();
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsEncrypting(true);
    setErrorMsg('');

    try {
      const fileList = Array.from(files);
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];

        const isVideo = file.type.startsWith('video');
        const isImage = file.type.startsWith('image');
        const fileType: 'image' | 'video' | 'file' = isVideo ? 'video' : isImage ? 'image' : 'file';

        const arrayBuffer = await file.arrayBuffer();
        const rawBytes = new Uint8Array(arrayBuffer);

        const success = await vaultService.addVaultItem({
          folderId: activeFolderId === 'root' ? undefined : activeFolderId || undefined,
          type: fileType,
          mimeType: file.type,
          name: file.name,
          rawBytes,
        });

        if (!success) {
          setErrorMsg('Failed to add some media items.');
        }
      }

      refreshData();
    } catch (err: any) {
      console.error('File import error:', err);
      setErrorMsg(err.message || 'Error uploading file.');
    } finally {
      setIsEncrypting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // -------------------------------------------------------------------------
  // LONG-PRESS / SELECTION HANDLERS
  // -------------------------------------------------------------------------
  const handleItemTouchStart = (e: React.TouchEvent, itemId: string) => {
    isTouchDeviceRef.current = true;
    isLongPressActiveRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setIsSelectMode(true);
      setSelectedItemIds((prev) => prev.includes(itemId) ? prev : [...prev, itemId]);
    }, 380);
  };

  const handleItemMouseDown = (e: React.MouseEvent, itemId: string) => {
    if (isTouchDeviceRef.current) return;
    isLongPressActiveRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setIsSelectMode(true);
      setSelectedItemIds((prev) => prev.includes(itemId) ? prev : [...prev, itemId]);
    }, 380);
  };

  const handleItemTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleItemClick = (item: VaultItem, globalIdx: number) => {
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }

    if (isSelectMode) {
      if (selectedItemIds.includes(item.id)) {
        const updated = selectedItemIds.filter(id => id !== item.id);
        setSelectedItemIds(updated);
        if (updated.length === 0) {
          setIsSelectMode(false);
        }
      } else {
        setSelectedItemIds([...selectedItemIds, item.id]);
      }
    } else {
      setViewerItemIndex(globalIdx);
    }
  };

  const handleSelectAll = () => {
    if (selectedItemIds.length === filteredItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map(i => i.id));
    }
  };

  const onRequestDeleteSelected = () => {
    if (selectedItemIds.length === 0) return;
    setModalAction('confirm-delete');
  };

  const handleConfirmDelete = async () => {
    if (selectedItemIds.length === 0) return;
    const success = await vaultService.deleteVaultItemsBatch(selectedItemIds);
    if (success) {
      setSelectedItemIds([]);
      setIsSelectMode(false);
      setModalAction(null);
      refreshData();
      if (viewerItemIndex !== null) setViewerItemIndex(null);
    } else {
      setErrorMsg('Failed to delete selected media.');
    }
  };

  const handleConfirmDeleteSingle = async () => {
    if (!targetItemForModal) return;
    const success = await vaultService.deleteVaultItem(targetItemForModal.id);
    if (success) {
      setModalAction(null);
      setTargetItemForModal(null);
      refreshData();
      setViewerItemIndex(null);
    } else {
      setErrorMsg('Failed to delete media item.');
    }
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalInputVal.trim()) return;
    const newFolder = vaultService.createFolder(modalInputVal);
    setModalInputVal('');
    setModalAction(null);
    refreshData();
    if (newFolder) setActiveFolderId(newFolder.id);
  };

  const handleRenameItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalInputVal.trim() || !targetItemForModal) return;
    vaultService.renameVaultItem(targetItemForModal.id, modalInputVal);
    setModalInputVal('');
    setModalAction(null);
    setTargetItemForModal(null);
    refreshData();
  };

  const handleMoveSelectedToFolder = (targetFolderId?: string) => {
    if (selectedItemIds.length === 0) return;
    vaultService.moveItemsToFolder(selectedItemIds, targetFolderId);
    setSelectedItemIds([]);
    setIsSelectMode(false);
    setModalAction(null);
    refreshData();
  };

  const handleCopySelectedToFolder = async (targetFolderId?: string) => {
    if (selectedItemIds.length === 0) return;
    await vaultService.copyItemsToFolder(selectedItemIds, targetFolderId);
    setSelectedItemIds([]);
    setIsSelectMode(false);
    setModalAction(null);
    refreshData();
  };

  if (!isOpen) return null;

  const filteredItems = items.filter(item => {
    if (activeFolderId === 'root') {
      if (item.folderId) return false;
    } else if (activeFolderId !== null) {
      if (item.folderId !== activeFolderId) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => b.dateAdded - a.dateAdded);

  const storedQ = vaultService.getRecoveryQuestion() || 'What is our special date or memorable keyword?';
  const isSettingsView = gallerySubView === 'settings';
  const currentFolder = folders.find(f => f.id === activeFolderId);

  // -------------------------------------------------------------------------
  // RENDER AUTH / SETUP SCREENS
  // -------------------------------------------------------------------------
  if (!isUnlocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#040711]/98 backdrop-blur-xl animate-digit-fade">
        <div className="glass-panel w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-white/10 relative flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
            <h2 className="text-sm font-semibold tracking-wide text-slate-100">
              Vault
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 px-2.5 py-1 text-xs rounded-xl hover:bg-white/5 transition-colors"
              aria-label="Close"
            >
              Close
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {!hasPass || authView === 'create' ? (
            /* FIRST TIME SETUP FORM */
            <form onSubmit={handleCreatePassword} className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Set Password</h3>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="New password (min 4 chars)"
                    autoFocus
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900/90 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400/80 pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-[10px] font-mono py-1 px-1.5"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900/90 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400/80"
                />

                <div className="pt-2 space-y-2">
                  <label className="block text-[11px] font-mono text-indigo-200/80 uppercase tracking-wider">
                    Security Question
                  </label>
                  <input
                    type="text"
                    value={recoveryQuestion}
                    onChange={(e) => setRecoveryQuestion(e.target.value)}
                    placeholder="e.g. What is our special date?"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900/90 border border-white/10 text-slate-100 placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    value={recoveryAnswer}
                    onChange={(e) => setRecoveryAnswer(e.target.value)}
                    placeholder="Security answer"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900/90 border border-white/10 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.25)] mt-2 active:scale-95"
              >
                Create Password
              </button>
            </form>
          ) : authView === 'forgot' ? (
            /* FORGOT PASSWORD RECOVERY FLOW */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h3 className="text-sm font-medium text-slate-100">
                  Password Recovery
                </h3>
                <button
                  type="button"
                  onClick={() => { setAuthView('unlock'); setIsRecoveryVerified(false); setErrorMsg(''); }}
                  className="text-xs text-indigo-300 hover:underline"
                >
                  Back
                </button>
              </div>

              {!isRecoveryVerified ? (
                <form onSubmit={handleVerifyForgotRecovery} className="space-y-3">
                  <p className="text-xs text-slate-300 font-medium">
                    Question: <span className="text-indigo-200 font-normal">{storedQ}</span>
                  </p>
                  <input
                    type="text"
                    value={forgotAnswerInput}
                    onChange={(e) => setForgotAnswerInput(e.target.value)}
                    placeholder="Enter security answer"
                    autoFocus
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900/90 border border-white/10 text-slate-100 placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl active:scale-95 transition-all"
                  >
                    Verify Answer
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPasswordAfterRecovery} className="space-y-3">
                  <p className="text-xs text-emerald-300">
                    Verified. Enter your new password below.
                  </p>
                  <input
                    type="password"
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="Enter new password (min 4 chars)"
                    autoFocus
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900/90 border border-white/10 text-slate-100 placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl active:scale-95 transition-all"
                  >
                    Save & Unlock
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* UNLOCK SCREEN */
            <form onSubmit={handleUnlock} className="space-y-4 py-2 text-center">
              <div className="relative text-left pt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900/90 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400/80 pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-[10px] font-mono py-1 px-1.5"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all flex-1 mr-3 active:scale-95"
                >
                  Unlock
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthView('forgot'); setErrorMsg(''); }}
                  className="text-xs text-indigo-300 hover:underline py-2"
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER FULL-SCREEN ROMANTIC & ELEGANT GALLERY EXPERIENCE
  // -------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#060b19] via-[#040711] to-[#02040a] flex flex-col text-slate-100 animate-digit-fade overflow-hidden select-none">
      {/* Hidden file input for web fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,application/*,text/*"
        multiple
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Subtle top romantic ambient glow */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-indigo-500/[0.07] via-rose-500/[0.03] to-transparent pointer-events-none" />

      {/* Top Navbar */}
      <header className="min-h-[3.5rem] pt-[calc(10px+env(safe-area-inset-top,0px))] pb-2 px-4 sm:px-6 bg-[#060b19]/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          {(activeFolderId !== null || isSettingsView) ? (
            <button
              onClick={() => {
                if (isSettingsView) setGallerySubView('grid');
                else setActiveFolderId(null);
              }}
              className="px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-xs font-medium"
              title="Back"
            >
              Back
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-xs font-medium"
              title="Exit"
            >
              Exit
            </button>
          )}

          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-wide text-slate-100">
              {isSettingsView 
                ? 'Settings' 
                : activeFolderId === null 
                  ? 'Vault' 
                  : currentFolder?.name || 'Folder'}
            </h1>
            <span className="text-xs text-slate-400 font-mono">
              {!isSettingsView && `(${filteredItems.length})`}
            </span>
          </div>
        </div>

        {/* Right Action Buttons / Multi-select Action Bar */}
        <div className="flex items-center gap-1.5">
          {isSelectMode ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono text-indigo-300 mr-1">
                {selectedItemIds.length} selected
              </span>

              <button
                onClick={handleSelectAll}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 text-xs font-medium text-slate-200 hover:bg-white/15 transition-colors"
                title="Select All"
              >
                {selectedItemIds.length === filteredItems.length ? 'Deselect' : 'All'}
              </button>

              {selectedItemIds.length > 0 && (
                <>
                  <button
                    onClick={() => setModalAction('copy-items')}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-medium shadow-[0_0_12px_rgba(99,102,241,0.3)] transition-colors"
                    title="Copy to Folder"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setModalAction('move-items')}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-medium shadow-[0_0_12px_rgba(99,102,241,0.3)] transition-colors"
                    title="Move to Folder"
                  >
                    Move
                  </button>
                  <button
                    onClick={onRequestDeleteSelected}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-medium shadow-[0_0_12px_rgba(225,29,72,0.3)] transition-colors"
                    title="Delete Selected"
                  >
                    Delete
                  </button>
                </>
              )}

              <button
                onClick={() => { setIsSelectMode(false); setSelectedItemIds([]); }}
                className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs font-medium"
                title="Exit Selection"
              >
                Done
              </button>
            </div>
          ) : isSettingsView ? (
            <button
              onClick={handleLockVault}
              className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-medium active:scale-95 transition-all"
            >
              Lock
            </button>
          ) : (
            <>
              {/* Add Media */}
              <button
                type="button"
                onClick={() => handleAddMediaClick('all')}
                disabled={isEncrypting}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)] disabled:opacity-50 active:scale-95"
                title="Add Media"
              >
                {isEncrypting ? 'Adding...' : 'Add'}
              </button>

              {/* Toggle Search */}
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${showSearch ? 'bg-white/10 text-indigo-300' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                title="Search"
              >
                Search
              </button>

              {/* Select Mode Toggle */}
              {filteredItems.length > 0 && (
                <button
                  onClick={() => setIsSelectMode(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors"
                >
                  Select
                </button>
              )}

              {/* Settings */}
              <button
                onClick={() => setGallerySubView('settings')}
                className="px-2.5 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 text-xs font-medium transition-colors"
                title="Settings"
              >
                Settings
              </button>

              {/* Lock */}
              <button
                onClick={handleLockVault}
                className="px-2.5 py-1.5 rounded-xl text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 text-xs font-medium transition-colors"
                title="Lock"
              >
                Lock
              </button>
            </>
          )}
        </div>
      </header>

      {/* Small loading/progress banner during media import */}
      {isEncrypting && (
        <div className="mx-4 my-2 p-2.5 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 text-indigo-200 text-xs flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.2)]">
          <span>Importing & encrypting into private Vault...</span>
        </div>
      )}

      {errorMsg && !isSettingsView && (
        <div className="mx-4 my-2 p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="px-2 py-0.5 text-xs hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Optional Search Bar */}
      {showSearch && !isSettingsView && (
        <div className="px-4 py-2 bg-slate-900/90 border-b border-white/10">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name..."
            autoFocus
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-black/50 border border-white/10 text-slate-100 placeholder:text-slate-500"
          />
        </div>
      )}

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 pb-[calc(20px+env(safe-area-inset-bottom,0px))] space-y-4">
        {isSettingsView ? (
          /* SIMPLE SETTINGS VIEW */
          <div className="max-w-md mx-auto py-2 space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-indigo-500/15 border border-indigo-400/30 text-indigo-200 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Change Password */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              setErrorMsg('');
              if (!oldPassInput || !newPassInput || newPassInput.length < 4) {
                setErrorMsg('Enter valid passwords (min 4 chars).');
                return;
              }
              const success = await vaultService.changePassword(oldPassInput, newPassInput);
              if (success) {
                setOldPassInput('');
                setNewPassInput('');
                setErrorMsg('Password updated.');
              } else {
                setErrorMsg('Incorrect current password.');
              }
            }} className="space-y-3 p-4 rounded-2xl bg-white/[0.04] border border-white/10">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                <span>Change Password</span>
              </h3>
              <input
                type="password"
                value={oldPassInput}
                onChange={(e) => setOldPassInput(e.target.value)}
                placeholder="Current password"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-white/10 text-slate-100"
              />
              <input
                type="password"
                value={newPassInput}
                onChange={(e) => setNewPassInput(e.target.value)}
                placeholder="New password (min 4 chars)"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-white/10 text-slate-100"
              />
              <button
                type="submit"
                className="w-full py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl active:scale-95 transition-all"
              >
                Update Password
              </button>
            </form>

            {/* Backup & Restore */}
            <div className="space-y-3 p-4 rounded-2xl bg-white/[0.04] border border-white/10">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-400" />
                <span>Backup & Restore</span>
              </h3>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg('');
                if (!backupPassInput) {
                  setErrorMsg('Enter password to export backup.');
                  return;
                }
                const jsonString = await vaultService.exportBackup(backupPassInput);
                if (!jsonString) {
                  setErrorMsg('Incorrect password.');
                  return;
                }

                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Vault_Backup_${new Date().toISOString().slice(0, 10)}.enc`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setBackupPassInput('');
                setErrorMsg('Backup exported.');
              }} className="space-y-2">
                <input
                  type="password"
                  value={backupPassInput}
                  onChange={(e) => setBackupPassInput(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-white/10 text-slate-100"
                />
                <button
                  type="submit"
                  className="w-full py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Backup</span>
                </button>
              </form>

              <div className="pt-2 border-t border-white/10 space-y-2">
                <input
                  ref={restoreFileInputRef}
                  type="file"
                  accept=".enc,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const content = event.target?.result as string;
                      if (content) {
                        setRestoreFileContent(content);
                        setErrorMsg('Backup loaded. Enter password below to confirm.');
                      }
                    };
                    reader.readAsText(file);
                  }}
                  className="w-full text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:bg-indigo-600 file:text-white"
                />
                {restoreFileContent && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="password"
                      value={restorePassInput}
                      onChange={(e) => setRestorePassInput(e.target.value)}
                      placeholder="Backup password"
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-white/10 text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setErrorMsg('');
                        const success = await vaultService.restoreBackup(restoreFileContent, restorePassInput);
                        if (success) {
                          setRestoreFileContent(null);
                          setRestorePassInput('');
                          setGallerySubView('grid');
                          refreshData();
                        } else {
                          setErrorMsg('Restore failed: Invalid password or file.');
                        }
                      }}
                      className="w-full py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl active:scale-95 transition-all"
                    >
                      Confirm Restore
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* MAIN GALLERY VIEW (Folders & Media Grid) */
          <div className="space-y-4 max-w-5xl mx-auto">
            {/* Folder Horizontal Scroll / Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setActiveFolderId(null)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all ${activeFolderId === null ? 'bg-indigo-600/90 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] border border-indigo-400/40' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
              >
                All ({items.length})
              </button>

              {folders.map((folder) => {
                const isSelected = activeFolderId === folder.id;
                const count = items.filter(i => i.folderId === folder.id).length;
                return (
                  <div key={folder.id} className="flex items-center shrink-0">
                    <button
                      onClick={() => setActiveFolderId(folder.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${isSelected ? 'bg-indigo-600/90 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] border border-indigo-400/40' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                    >
                      <Folder className="w-3.5 h-3.5 opacity-80" />
                      <span>{folder.name}</span>
                      <span className="opacity-60 text-[10px]">({count})</span>
                    </button>
                    {isSelected && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete folder "${folder.name}"? Photos will return to All.`)) {
                            vaultService.deleteFolder(folder.id);
                            setActiveFolderId(null);
                            refreshData();
                          }
                        }}
                        className="ml-1 p-1 text-slate-400 hover:text-rose-400"
                        title="Delete Folder"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => { setModalAction('new-folder'); setModalInputVal(''); }}
                className="px-3 py-1.5 rounded-full text-xs font-medium text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-400/20 shrink-0 flex items-center gap-1 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ Folder</span>
              </button>
            </div>

            {/* Photos & Videos Grid */}
            {filteredItems.length === 0 ? (
              <div className="py-20 text-center space-y-4 px-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-300 mx-auto shadow-[0_0_20px_rgba(244,63,94,0.15)]">
                  <Heart className="w-6 h-6 fill-rose-500/20" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-100">Your Vault is Empty</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Safely import and encrypt photos and videos to keep them private.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => handleAddMediaClick('image')}
                    disabled={isEncrypting}
                    className="px-4 py-2.5 text-xs font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.25)] inline-flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Add Photos</span>
                  </button>
                  <button
                    onClick={() => handleAddMediaClick('video')}
                    disabled={isEncrypting}
                    className="px-4 py-2.5 text-xs font-medium text-white bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400 rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.25)] inline-flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Add Videos</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {filteredItems.map((item, filteredIdx) => {
                  const isSelected = selectedItemIds.includes(item.id);
                  return (
                    <VaultItemTile
                      key={item.id}
                      item={item}
                      globalIdx={filteredIdx}
                      isSelected={isSelected}
                      isSelectMode={isSelectMode}
                      onItemClick={handleItemClick}
                      onTouchStart={handleItemTouchStart}
                      onTouchEnd={handleItemTouchEnd}
                      onMouseDown={handleItemMouseDown}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* FULL-SCREEN INTERACTIVE PHOTO VIEWER (Zoom, Pinch, Pan, Swipe) */}
      {/* ------------------------------------------------------------------------- */}
      {viewerItemIndex !== null && filteredItems[viewerItemIndex] && (
        <VaultPhotoViewer
          items={filteredItems}
          initialIndex={viewerItemIndex}
          isOpen={viewerItemIndex !== null}
          onClose={() => setViewerItemIndex(null)}
          onRenameItem={(item) => {
            setTargetItemForModal(item);
            setModalInputVal(item.name);
            setModalAction('rename-item');
          }}
          onDeleteItem={(item) => {
            setTargetItemForModal(item);
            setModalAction('confirm-delete-single');
          }}
        />
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* CONFIRMATION & ACTION DIALOG MODALS */}
      {/* ------------------------------------------------------------------------- */}
      {modalAction && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setModalAction(null)}
        >
          <div
            className="glass-panel w-full max-w-xs rounded-2xl p-5 shadow-2xl border border-white/10 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {modalAction === 'confirm-delete' && (
              <div className="space-y-4 text-center">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Delete Item(s)?</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Delete {selectedItemIds.length} selected item(s)?
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalAction(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-[0_0_15px_rgba(225,29,72,0.3)] transition-colors active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {modalAction === 'confirm-delete-single' && (
              <div className="space-y-4 text-center">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Delete Item?</h3>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalAction(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteSingle}
                    className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-[0_0_15px_rgba(225,29,72,0.3)] transition-colors active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {modalAction === 'new-folder' && (
              <form onSubmit={handleCreateFolderSubmit} className="space-y-3">
                <h3 className="text-sm font-medium text-slate-100">New Folder</h3>
                <input
                  type="text"
                  value={modalInputVal}
                  onChange={(e) => setModalInputVal(e.target.value)}
                  placeholder="Folder name"
                  autoFocus
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-white/10 text-slate-100"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setModalAction(null)}
                    className="px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl active:scale-95 transition-all"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            {modalAction === 'rename-item' && (
              <form onSubmit={handleRenameItemSubmit} className="space-y-3">
                <h3 className="text-sm font-medium text-slate-100">Rename Item</h3>
                <input
                  type="text"
                  value={modalInputVal}
                  onChange={(e) => setModalInputVal(e.target.value)}
                  placeholder="New item name"
                  autoFocus
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-white/10 text-slate-100"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setModalAction(null)}
                    className="px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl active:scale-95 transition-all"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}

            {modalAction === 'move-items' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-100">Move {selectedItemIds.length} item(s)</h3>
                  <button
                    onClick={() => { setModalAction('new-folder'); setModalInputVal(''); }}
                    className="text-xs text-indigo-300 hover:underline flex items-center gap-1"
                  >
                    <FolderPlus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  <button
                    onClick={() => handleMoveSelectedToFolder(undefined)}
                    className="w-full text-left px-3 py-2 text-xs rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 transition-colors flex items-center gap-2"
                  >
                    <Folder className="w-4 h-4 text-indigo-400" />
                    <span>All (Root)</span>
                  </button>
                  {folders.map(f => (
                    <button
                      key={f.id}
                      onClick={() => handleMoveSelectedToFolder(f.id)}
                      className="w-full text-left px-3 py-2 text-xs rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 transition-colors flex items-center gap-2"
                    >
                      <Folder className="w-4 h-4 text-indigo-400" />
                      <span>{f.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setModalAction(null)}
                    className="px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {modalAction === 'copy-items' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-100">Copy {selectedItemIds.length} item(s)</h3>
                  <button
                    onClick={() => { setModalAction('new-folder'); setModalInputVal(''); }}
                    className="text-xs text-indigo-300 hover:underline flex items-center gap-1"
                  >
                    <FolderPlus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  <button
                    onClick={() => handleCopySelectedToFolder(undefined)}
                    className="w-full text-left px-3 py-2 text-xs rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 transition-colors flex items-center gap-2"
                  >
                    <Folder className="w-4 h-4 text-indigo-400" />
                    <span>All (Root)</span>
                  </button>
                  {folders.map(f => (
                    <button
                      key={f.id}
                      onClick={() => handleCopySelectedToFolder(f.id)}
                      className="w-full text-left px-3 py-2 text-xs rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 transition-colors flex items-center gap-2"
                    >
                      <Folder className="w-4 h-4 text-indigo-400" />
                      <span>{f.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setModalAction(null)}
                    className="px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
