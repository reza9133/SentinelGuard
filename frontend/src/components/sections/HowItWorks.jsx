import { motion } from "framer-motion";

const STEPS = [
  {
    n: "01",
    title: "Register target & rulebook",
    body: "Any contract registers itself with SentinelGuard and declares its own rulebook — plain-language invariants describing what normal behaviour looks like.",
  },
  {
    n: "02",
    title: "Report incident, with a GEN bond",
    body: "Anyone can flag a target with evidence. A bond is required and only refunded if the report actually triggers a halt or resume — spam costs real GEN.",
  },
  {
    n: "03",
    title: "LLM consensus adjudication",
    body: "Validators independently read the rulebook against the evidence. A decision only stands once the committee agrees within a confidence tolerance — no single model decides alone.",
  },
  {
    n: "04",
    title: "Autonomous halt, resume & self-tuning",
    body: "A confirmed violation halts the target immediately. Confidence bars drift up or down over time based on near-misses and false alarms — no proposal, no vote.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-black/5 bg-white py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            How the protocol runs itself
          </h2>
          <p className="mt-3 text-muted">
            Four steps, all deterministic except one — and even that one is
            settled by consensus, not by any single model.
          </p>
        </div>

        <div className="relative mt-14 grid gap-x-6 gap-y-10 lg:grid-cols-4">
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-chain-300 via-compute-300 to-transparent lg:block" />
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.12 }}
              className="relative"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-chain-300/70 bg-chain-50 font-display text-sm font-semibold text-chain-600 transition-transform hover:scale-105">
                {step.n}
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
