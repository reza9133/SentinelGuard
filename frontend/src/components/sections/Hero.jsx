import { motion } from "framer-motion";
import Button from "../ui/Button.jsx";
import GenLayerMark from "../icons/GenLayerMark.jsx";
import { LINKS } from "../../config/network.js";

const NODES = [
  { x: 40, y: 40 },
  { x: 260, y: 30 },
  { x: 290, y: 200 },
  { x: 150, y: 250 },
  { x: 20, y: 190 },
];

const SHIELD_CENTER = { x: 165, y: 130 };

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-16 sm:pt-20">
      <GradientBlobs />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.12 } } }}
        >
          <motion.span
            variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
            className="inline-flex items-center gap-2 rounded-full border border-chain-300/60 bg-chain-50 px-3 py-1 text-xs font-medium text-chain-600"
          >
            <GenLayerMark size={13} className="!gap-1" />
            <span className="opacity-40">·</span>
            Autonomous Protocols track
          </motion.span>

          <motion.h1
            variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
            className="mt-5 text-balance font-display text-[2.6rem] font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl"
          >
            AI-powered autonomous emergency halt & governance
          </motion.h1>

          <motion.p
            variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
            className="mt-5 max-w-xl text-lg leading-relaxed text-muted"
          >
            SentinelGuard watches registered contracts against their own
            plain-language rulebook. When evidence of a violation clears
            validator consensus, it halts the target immediately — and tunes
            its own sensitivity over time. No proposal. No committee. No one
            votes.
          </motion.p>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button as="a" href="#targets">
              View targets
            </Button>
            <Button as="a" href={LINKS.github} target="_blank" rel="noreferrer" variant="secondary">
              Read the source
            </Button>
          </motion.div>

          <motion.div
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
            className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted"
          >
            <Metric label="Confidence tolerance" value="±12 pts" />
            <Metric label="Incident bond" value="2 GEN" />
            <Metric label="Resume cooldown" value="5 min" />
          </motion.div>
        </motion.div>

        <ConsensusGraphic />
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="font-display text-lg font-semibold text-ink">{value}</div>
      <div>{label}</div>
    </div>
  );
}

/**
 * Two soft, slowly-drifting gradient fields behind the hero content. Pure
 * decoration - aria-hidden, pointer-events-none, ignored by scroll reveals
 * elsewhere so it never competes with the content for attention.
 */
function GradientBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-chain-300/30 blur-[90px]"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ repeat: Infinity, duration: 16, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 top-10 h-[30rem] w-[30rem] rounded-full bg-compute-300/25 blur-[100px]"
        animate={{ x: [0, -25, 0], y: [0, 30, 0] }}
        transition={{ repeat: Infinity, duration: 20, ease: "easeInOut", delay: 1 }}
      />
    </div>
  );
}

function ConsensusGraphic() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative mx-auto aspect-square w-full max-w-md"
    >
      <svg viewBox="0 0 330 260" className="h-full w-full" fill="none">
        {NODES.map((node, i) => (
          <motion.line
            key={`line-${i}`}
            x1={node.x}
            y1={node.y}
            x2={SHIELD_CENTER.x}
            y2={SHIELD_CENTER.y}
            stroke="#B9B0FF"
            strokeWidth="1.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.4 + i * 0.1, duration: 0.7, ease: "easeInOut" }}
          />
        ))}

        {NODES.map((node, i) => (
          <motion.g
            key={`node-${i}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
          >
            <circle cx={node.x} cy={node.y} r="9" fill="#EAF7FF" stroke="#2686C4" strokeWidth="1.5" />
            <motion.circle
              cx={node.x}
              cy={node.y}
              r="9"
              stroke="#2686C4"
              strokeWidth="1"
              fill="none"
              animate={{ scale: [1, 1.9], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 2.4, delay: i * 0.4, ease: "easeOut" }}
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            />
          </motion.g>
        ))}

        <motion.g
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.1, duration: 0.5, type: "spring", stiffness: 160 }}
          style={{ transformOrigin: `${SHIELD_CENTER.x}px ${SHIELD_CENTER.y}px` }}
        >
          <path
            d={`M${SHIELD_CENTER.x} ${SHIELD_CENTER.y - 45}
                L${SHIELD_CENTER.x + 38} ${SHIELD_CENTER.y - 32}
                V${SHIELD_CENTER.y + 5}
                C${SHIELD_CENTER.x + 38} ${SHIELD_CENTER.y + 33} ${SHIELD_CENTER.x + 20} ${SHIELD_CENTER.y + 45} ${SHIELD_CENTER.x} ${SHIELD_CENTER.y + 52}
                C${SHIELD_CENTER.x - 20} ${SHIELD_CENTER.y + 45} ${SHIELD_CENTER.x - 38} ${SHIELD_CENTER.y + 33} ${SHIELD_CENTER.x - 38} ${SHIELD_CENTER.y + 5}
                V${SHIELD_CENTER.y - 32} Z`}
            fill="url(#hero-shield-grad)"
          />
          <circle cx={SHIELD_CENTER.x} cy={SHIELD_CENTER.y} r="8" fill="rgba(255,255,255,0.94)" />
          <circle cx={SHIELD_CENTER.x} cy={SHIELD_CENTER.y} r="3.4" fill="#251E63" />
        </motion.g>

        <defs>
          <linearGradient
            id="hero-shield-grad"
            x1={SHIELD_CENTER.x - 38}
            y1={SHIELD_CENTER.y - 45}
            x2={SHIELD_CENTER.x + 38}
            y2={SHIELD_CENTER.y + 52}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#6D5DF5" />
            <stop offset="1" stopColor="#2686C4" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-medium text-muted shadow-glass">
        5 validators → 1 decision
      </span>
    </motion.div>
  );
}
