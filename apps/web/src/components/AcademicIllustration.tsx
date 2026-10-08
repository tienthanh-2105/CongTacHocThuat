export default function AcademicIllustration() {
  return (
    <svg
      className="academic-illustration"
      viewBox="0 0 400 340"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="platform"
          x1="80"
          y1="230"
          x2="300"
          y2="300"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#c3c7ff" />
        </linearGradient>
        <linearGradient
          id="screen"
          x1="140"
          y1="60"
          x2="285"
          y2="180"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#d2e2ff" />
        </linearGradient>
        <linearGradient
          id="robe"
          x1="175"
          y1="150"
          x2="245"
          y2="225"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#9d74ff" />
          <stop offset="1" stopColor="#5e40c4" />
        </linearGradient>
        <pattern
          id="tiles"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <path d="M24 0H0v24" stroke="#a9b7f0" strokeWidth=".6" />
        </pattern>
      </defs>
      <ellipse
        cx="202"
        cy="303"
        rx="110"
        ry="16"
        fill="#1e3793"
        opacity=".16"
      />
      <path
        d="m76 250 117-66q9-5 18 0l117 66q12 7 0 14l-117 67q-9 5-18 0L76 264q-12-7 0-14Z"
        fill="#e3e8ff"
      />
      <path
        d="m76 235 117-66q9-5 18 0l117 66q12 7 0 14l-117 67q-9 5-18 0L76 249q-12-7 0-14Z"
        fill="url(#platform)"
      />
      <path
        d="m89 240 113-64 113 64-113 65-113-65Z"
        fill="url(#tiles)"
        opacity=".55"
      />
      <g transform="translate(174 28) skewY(25)">
        <rect width="108" height="114" rx="7" fill="#7382e8" />
        <rect
          x="-5"
          y="-5"
          width="108"
          height="114"
          rx="7"
          fill="url(#screen)"
        />
        <rect x="7" y="8" width="84" height="5" rx="2" fill="#93a8ef" />
        <circle cx="22" cy="36" r="12" stroke="#8c77f0" strokeWidth="4" />
        <path d="M22 24a12 12 0 0 1 12 12" stroke="#ed81d3" strokeWidth="4" />
        <rect x="44" y="27" width="41" height="4" rx="2" fill="#a5b4e7" />
        <rect x="44" y="38" width="30" height="4" rx="2" fill="#b7c6ed" />
        <path
          d="M10 67h78M10 82h78M10 97h45"
          stroke="#a5b8f1"
          strokeWidth="3"
        />
        <path
          d="m16 72 13-13 15 10 15-18 20 7"
          stroke="#42c8e9"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <g transform="translate(82 83) skewY(-28)">
        <rect width="66" height="74" rx="5" fill="#c7d3ff" />
        <rect x="-4" y="-4" width="66" height="74" rx="5" fill="#f7f5ff" />
        <rect x="7" y="35" width="8" height="24" rx="1" fill="#9f79f5" />
        <rect x="21" y="23" width="8" height="36" rx="1" fill="#eb89d2" />
        <rect x="35" y="12" width="8" height="47" rx="1" fill="#67c9f6" />
        <rect x="49" y="6" width="6" height="53" rx="1" fill="#8a83f5" />
      </g>
      <g transform="translate(294 66)">
        <ellipse
          cx="0"
          cy="0"
          rx="22"
          ry="28"
          transform="rotate(-24)"
          fill="#9b87f5"
        />
        <ellipse
          cx="-4"
          cy="-2"
          rx="19"
          ry="25"
          transform="rotate(-24 -4 -2)"
          fill="#d7e5ff"
          stroke="#b6abff"
          strokeWidth="3"
        />
        <path
          d="m-5-17 1 15 10 6"
          stroke="#6782dc"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
      <path d="m180 200 6 72q0 10 10 10t8-10l2-64" fill="#53c2ee" />
      <path d="m207 205 3 62q1 9 10 9t7-10l-1-66" fill="#7ed5f9" />
      <ellipse cx="197" cy="282" rx="13" ry="5" fill="#5550b3" />
      <ellipse cx="221" cy="276" rx="13" ry="5" fill="#5550b3" />
      <path d="M179 155q23-17 46 4l8 55q-23 14-54-2l-5-38Z" fill="url(#robe)" />
      <path
        d="m222 165 18 13 16-26"
        stroke="#8561e2"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="m253 153 5-9"
        stroke="#efb5cc"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="m181 169-13 27 17 10"
        stroke="#7354d7"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <ellipse cx="201" cy="138" rx="13" ry="17" fill="#f2b7cd" />
      <path d="M188 140v-15q16-17 27 2l-3 11-6-12-18 4" fill="#6550b7" />
      <path d="m177 119 25-12 26 11-26 13-25-12Z" fill="#47339c" />
      <path d="m185 123 1 10q16 8 31-1v-10" fill="#6451bc" />
      <path d="m225 119 1 17" stroke="#f8d27e" strokeWidth="2" />
      <g transform="translate(56 196)">
        <path d="m0 0 16-9 16 9-16 10L0 0Z" fill="#7de8fb" />
        <path d="M0 0v22l16 10V10L0 0Z" fill="#bcdaff" />
        <path d="m16 10 16-10v22L16 32V10Z" fill="#91b3fa" />
      </g>
      <g transform="translate(310 196)">
        <path d="m0 0 16-9 16 9-16 10L0 0Z" fill="#8cffe1" />
        <path d="M0 0v22l16 10V10L0 0Z" fill="#d8fff4" />
        <path d="m16 10 16-10v22L16 32V10Z" fill="#27cebc" />
      </g>
      <g transform="translate(306 274) scale(.7)">
        <path d="m0 0 16-9 16 9-16 10L0 0Z" fill="#f7a5eb" />
        <path d="M0 0v22l16 10V10L0 0Z" fill="#f8d6f5" />
        <path d="m16 10 16-10v22L16 32V10Z" fill="#b698ff" />
      </g>
      <circle cx="121" cy="194" r="4" fill="#96e4ff" />
      <circle cx="315" cy="136" r="3" fill="#bbacff" />
      <path
        d="M60 125h8m-4-4v8M286 267h8m-4-4v8"
        stroke="#c0eaff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
