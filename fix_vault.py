with open('src/components/MemoryVaultGalleryModal.tsx', 'r') as f:
    c = f.read()

import_line = "import React, { useState, useEffect, useRef, useCallback } from 'react';"
new_import_line = """import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  KeyRound, Download, Folder, Trash2, FolderPlus, Heart, Image as ImageIcon, Video 
} from 'lucide-react';"""

c = c.replace(import_line, new_import_line, 1)

with open('src/components/MemoryVaultGalleryModal.tsx', 'w') as f:
    f.write(c)

print("MemoryVaultGalleryModal imports restored")
