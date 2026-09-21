import { motion } from "framer-motion";
import GlassCard from "../ui/GlassCard.jsx";

const FEATURES = [
  {
    title: "Sybil-resistant bond",
    body:
      "report_incident and request_resume_review are payable. The bond is refunded in full only when a report actually triggers a halt or resume — every other outcome, including a near-miss that lands just under the bar, forfeits it to the contract's own treasury. Free reporting would let an attacker spam garbage evidence from unlimited addresses and walk the confidence bar to its ceiling at zero cost.",
  },
  {
    title: "Confidence tolerance",
    body:
      "Different validator LLMs score the same evidence a few points apart even when they agree on the substance. The decision label still has to match exactly across the committee; only the numeric confidence score is allowed a margin before it counts as disagreement.",
  },
];

export default function About() {
  return (
    <section id="about" className="py-24">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Built for GenLayer's Autonomous Protocols track
          </h2>
          <p className="mt-4 text-muted">
            The track brief asks for systems that run themselves: a contract
            that pauses, tunes, or rewrites another contract — or its own
            rules — with no one voting. SentinelGuard is one contract that
            does both halves at once: it is the emergency-halt module, and
            it is the thing that governs the rules by which it halts.
          </p>
          <p className="mt-4 text-muted">
            Every adjudication runs through GenLayer's validator consensus:
            each validator independently reads the same rulebook against the
            same evidence, and a decision only becomes real once the
            committee agrees. What comes after that decision — pausing the
            target, refunding or forfeiting the bond, nudging the confidence
            bar — is pure deterministic bookkeeping. No human, no committee,
            no proposal ever enters the loop.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <GlassCard className="h-full p-6 transition-shadow hover:shadow-lift">
                <h3 className="font-display text-[15px] font-semibold text-chain-600">{f.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">{f.body}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
