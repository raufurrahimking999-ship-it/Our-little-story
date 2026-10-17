with open('src/components/InitialOpeningTransition.tsx', 'r') as f:
    c = f.read()

old_h1_block = """        {/* Cinematic Opening Typography */}
        <h1 className="font-romantic text-2xl sm:text-3xl font-light tracking-[0.24em] sm:tracking-[0.28em] text-slate-100 flex items-center justify-center drop-shadow-[0_2px_24px_rgba(165,180,252,0.45)] text-glow-romantic">
          <span className="italic">Our little story</span>
        </h1>"""

new_h1_block = """        {/* Cinematic Opening Typography */}
        <h1 className="font-romantic text-2xl sm:text-3xl font-light tracking-[0.24em] sm:tracking-[0.28em] text-slate-100 flex items-center justify-center drop-shadow-[0_2px_24px_rgba(165,180,252,0.45)] text-glow-romantic">
          <span className="italic">our little story</span>
        </h1>

        {/* Small, Elegant Romantic Heart with Soft Glow */}
        <div className="flex items-center justify-center pt-0.5">
          <svg
            className="w-4 h-4 text-rose-300/85 filter drop-shadow-[0_0_8px_rgba(244,114,182,0.65)]"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>"""

if old_h1_block in c:
    c = c.replace(old_h1_block, new_h1_block, 1)
    with open('src/components/InitialOpeningTransition.tsx', 'w') as f:
        f.write(c)
    print("InitialOpeningTransition updated successfully!")
else:
    print("Error: old_h1_block not found in InitialOpeningTransition.tsx")
    exit(1)
