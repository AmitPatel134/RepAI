// Exact paths from logo2.svg (viewBox 0 0 1024 1024, fill transform applied)
const TRANSFORM = "translate(0,1024) scale(0.1,-0.1)"
const P1 = "M8015 8580 c-773 -329 -849 -364 -872 -399 -60 -89 6 -221 111 -221 36 0 187 55 461 168 66 28 121 49 123 47 1 -1 -54 -94 -124 -206 -70 -112 -260 -420 -422 -684 -350 -569 -911 -1478 -959 -1553 l-34 -53 -92 133 c-302 440 -321 467 -357 486 -51 28 -86 34 -131 22 -71 -20 -90 -48 -214 -325 -64 -143 -154 -343 -200 -445 -145 -323 -301 -672 -340 -762 -21 -49 -41 -88 -44 -88 -3 0 -33 53 -66 117 -33 64 -111 211 -173 327 -63 116 -133 250 -158 298 -59 116 -93 143 -184 143 -90 0 -124 -26 -181 -137 -23 -46 -83 -157 -134 -248 -51 -91 -159 -286 -240 -435 -81 -148 -152 -276 -158 -283 -8 -10 -143 -12 -643 -12 -445 1 -640 -2 -654 -10 -34 -18 -60 -71 -60 -119 0 -40 9 -56 98 -175 134 -180 316 -397 475 -568 350 -374 879 -806 1462 -1193 400 -266 504 -327 562 -333 28 -2 65 0 80 6 62 21 538 326 813 521 540 382 1002 785 1333 1163 353 403 617 901 707 1333 90 428 52 811 -113 1140 -48 97 -127 217 -175 267 l-35 37 -74 -107 c-40 -58 -75 -114 -78 -123 -3 -10 13 -48 39 -91 106 -175 156 -321 183 -533 70 -551 -221 -1229 -793 -1850 -195 -211 -471 -465 -724 -663 -58 -45 -121 -95 -140 -110 -189 -152 -967 -675 -1005 -675 -19 0 -491 312 -713 472 -74 53 -153 110 -176 126 -80 57 -321 249 -446 354 -227 193 -465 431 -687 689 -68 78 -123 144 -123 147 0 3 227 5 505 5 550 0 550 0 594 56 27 34 491 861 491 875 0 17 15 9 26 -14 5 -12 54 -105 109 -207 54 -102 147 -279 207 -395 124 -238 157 -279 231 -290 91 -14 155 26 199 124 17 36 70 154 118 261 48 107 122 272 165 365 42 94 149 332 237 530 88 198 163 364 167 368 5 4 97 -124 206 -286 158 -236 205 -299 235 -316 66 -37 149 -23 201 35 14 16 65 94 114 174 90 148 239 389 424 688 57 92 145 235 196 317 51 83 157 254 235 380 79 127 155 250 170 275 15 25 85 137 155 250 70 113 191 309 269 435 l141 230 7 -95 c4 -52 12 -174 18 -270 8 -114 17 -186 27 -207 22 -47 59 -67 123 -68 70 0 105 21 131 80 19 42 19 57 9 402 -20 638 -23 689 -46 720 -12 16 -36 38 -54 51 -60 40 -101 32 -335 -68z"
const P2 = "M3410 7099 c-380 -34 -756 -206 -1015 -464 -233 -233 -373 -511 -426 -850 -18 -111 -15 -386 5 -515 30 -192 96 -405 182 -591 l36 -76 71 18 c39 11 104 19 144 19 40 0 73 2 73 5 0 3 -11 28 -25 55 -78 154 -153 385 -184 570 -26 152 -28 385 -6 516 91 520 491 908 1055 1021 119 23 381 23 515 -1 187 -33 415 -122 573 -222 93 -60 212 -157 297 -244 90 -91 118 -110 169 -110 59 0 86 17 206 133 202 197 452 343 700 411 257 70 541 70 799 0 51 -14 97 -22 101 -17 29 32 129 194 132 213 3 22 -4 26 -72 48 -538 171 -1107 87 -1596 -237 -66 -43 -152 -109 -192 -146 l-72 -67 -58 54 c-290 268 -691 442 -1097 477 -134 12 -178 12 -315 0z"

interface LoadingScreenProps {
  color?: string
}

export default function LoadingScreen({ color = "#7c3aed" }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <svg viewBox="0 0 1024 1024" width={110} height={110} fill="none">
        <defs>
          {/* Glow filter — operates in SVG coordinate space (0-1024) */}
          <filter id="logoGlow" filterUnits="userSpaceOnUse" x="-120" y="-120" width="1264" height="1264">
            <feGaussianBlur in="SourceGraphic" stdDeviation="38" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <style>{`
            @keyframes glowTravel {
              from { stroke-dashoffset: 0; }
              to   { stroke-dashoffset: -1; }
            }
          `}</style>
        </defs>

        {/* Dim base logo */}
        <g transform={TRANSFORM} fill="#d1d5db">
          <path d={P1} />
          <path d={P2} />
        </g>

        {/* Glow segment travelling along the logo outline */}
        <g transform={TRANSFORM}>
          {/* P1 — main body */}
          <path
            d={P1}
            fill="none"
            stroke={color}
            strokeWidth="420"
            pathLength="1"
            strokeDasharray="0.22 0.78"
            strokeLinecap="round"
            filter="url(#logoGlow)"
            style={{ animation: "glowTravel 3.4s linear infinite" }}
          />
          {/* P2 — circular element, slightly offset */}
          <path
            d={P2}
            fill="none"
            stroke={color}
            strokeWidth="420"
            pathLength="1"
            strokeDasharray="0.28 0.72"
            strokeLinecap="round"
            filter="url(#logoGlow)"
            style={{ animation: "glowTravel 2.6s linear infinite 0.6s" }}
          />
        </g>
      </svg>
    </div>
  )
}
