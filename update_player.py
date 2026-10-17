with open('src/components/MusicPlayerCard.tsx', 'r') as f:
    content = f.read()

# 1. Update imports
old_import = "import React, { useState, useEffect, useRef } from 'react';\nimport { createPortal } from 'react-dom';\nimport { Capacitor } from '@capacitor/core';"
new_import = """import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { 
  Play, Pause, SkipBack, SkipForward, Heart, 
  Shuffle, Repeat, Repeat1, Volume2, VolumeX, ListMusic, ArrowLeft, Loader2
} from 'lucide-react';"""

if old_import not in content:
    print("Error: old_import not found")
    exit(1)

content = content.replace(old_import, new_import, 1)

# 2. Add isCurrentFav computation
anchor = "const currentSong = songs.find((s) => s.url === songUrl || (songName && songName.includes(s.title)));"
replacement = """const currentSong = songs.find((s) => s.url === songUrl || (songName && songName.includes(s.title)));
  const isCurrentFav = currentSong ? favorites.includes(currentSong.id) : false;"""

if anchor not in content:
    print("Error: anchor for currentSong not found")
    exit(1)

content = content.replace(anchor, replacement, 1)

with open('src/components/MusicPlayerCard.tsx', 'w') as f:
    f.write(content)

print("Imports and isCurrentFav updated successfully")
