import { motion } from 'framer-motion'
import { ArrowDown, ArrowRight, Check, Heart, ShieldCheck, Sparkles } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const CityScene = lazy(() => import('./CityScene'))

function LazyCityScene() {
  const [enabled, setEnabled] = useState(() => shouldLoadCityScene())
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 640px), (pointer: coarse)')
    const update = () => setEnabled(shouldLoadCityScene())
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])
  return enabled ? <Suspense fallback={null}><CityScene /></Suspense> : null
}

function shouldLoadCityScene() {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return !window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 640px), (pointer: coarse)').matches &&
    navigator.hardwareConcurrency > 4 && (memory == null || memory > 4)
}

const steps = [
  ['01', 'Show us your kind of home', 'A few thoughtful details help us understand what a good everyday fit looks like.'],
  ['02', 'Meet people who fit your life', 'See real profiles with clear preferences and a transparent compatibility breakdown.'],
  ['03', 'Take the next step, together', 'Chat first. Confirm together. Meet in public when you both feel ready.'],
]

export function LandingPage() {
  return (
    <main className="landing">
      <header className="site-nav">
        <Link className="brand" to="/" aria-label="Roomie home"><span className="brand-mark">r</span>roomie<span className="brand-dot">.</span></Link>
        <nav className="desktop-links" aria-label="Main navigation">
          <a href="#how">How it works</a><a href="#safety">Your safety</a><a href="#faq">FAQ</a>
        </nav>
        <div className="nav-actions"><Link className="nav-login" to="/login">Log in</Link><Link className="button button-lime button-small" to="/signup">Get started <ArrowRight size={15} /></Link></div>
      </header>

      <section className="hero-section">
        <div className="hero-scene" aria-hidden="true">
          <LazyCityScene />
          <div className="city-glow glow-one" /><div className="city-glow glow-two" />
          <div className="city-grid">
            {[0, 1, 2, 3, 4, 5, 6].map((building) => (
              <div className={`building building-${building}`} key={building}>
                {Array.from({ length: 18 }, (_, window) => <i key={window} className={`window window-${(window + building) % 5}`} />)}
              </div>
            ))}
          </div>
          <svg className="match-lines" viewBox="0 0 900 390" preserveAspectRatio="none">
            <path d="M170 220 C280 110 340 110 450 195 S630 300 730 145" />
            <circle cx="170" cy="220" r="4" /><circle cx="450" cy="195" r="4" /><circle cx="730" cy="145" r="4" />
          </svg>
        </div>
        <div className="hero-copy">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }} className="eyebrow"><span className="pulse-dot" /> A better kind of living together</motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08, duration: .7 }}>Your next flatmate<br />is just around<br /><span>the corner.</span></motion.h1>
          <p>Find someone who fits your space, your rhythm, and the little things that make a place feel like home.</p>
          <div className="hero-ctas"><Link className="button button-lime" to="/signup">Find your flatmate <ArrowRight size={17} /></Link><a className="button button-quiet" href="#how">Explore how it works <ArrowDown size={16} /></a></div>
          <div className="hero-trust"><div className="trust-avatars" aria-hidden="true"><span>J</span><span>A</span><span>M</span></div><span>Better flatshares start with better conversations.</span></div>
        </div>
        <div className="floating-note note-match"><Heart size={15} fill="currentColor" /> A more thoughtful match</div>
        <div className="floating-note note-safe"><ShieldCheck size={15} /> Meet on your terms</div>
        <a className="scroll-cue" href="#how"><span>SCROLL TO EXPLORE</span><span className="scroll-line" /></a>
      </section>

      <section className="intro-section" id="how">
        <div className="section-kicker">ROOM FOR THE RIGHT PEOPLE <span>— HOW IT WORKS</span></div>
        <div className="section-heading-row"><h2>More than a room.<br /><span>A good fit.</span></h2><p>Finding a flatmate is about more than rent and location. It’s the small everyday things that make living together work.</p></div>
        <div className="steps-grid">{steps.map(([number, title, description], index) => <motion.article className="step-card" key={number} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .3 }} transition={{ delay: index * .12 }}><span className="step-number">{number}</span><div className="step-icon">{index === 0 ? <Sparkles /> : index === 1 ? <Heart /> : <Check />}</div><h3>{title}</h3><p>{description}</p></motion.article>)}</div>
      </section>

      <section className="big-cta">
        <div className="big-cta-orb" aria-hidden="true" /><div className="section-kicker">YOUR NEXT CHAPTER STARTS HERE</div>
        <h2>Come home to<br /><span>good company.</span></h2><p>Tell us what you’re looking for. We’ll help you find people who are looking for the same.</p>
        <Link className="button button-lime button-large" to="/signup">Find your flatmate <ArrowRight size={18} /></Link>
      </section>

      <section className="values-section">
        <div className="section-kicker">THE ROOMIE DIFFERENCE</div><h2>Make room for <span>better.</span></h2>
        <div className="values-grid"><article><span className="value-mark lime">01</span><h3>Compatibility, with context</h3><p>See how your budgets, neighborhoods, move-in dates, and routines line up. No mystery scores.</p></article><article><span className="value-mark pink">02</span><h3>Move at your own pace</h3><p>Chat before you decide. Confirm a connection together. A meetup only happens when both of you are ready.</p></article><article id="safety"><span className="value-mark blue">03</span><h3>Safety is part of the plan</h3><p>Keep conversations here, verify details, and meet in public first. Your comfort comes first.</p></article></div>
      </section>

      <section className="faq-section" id="faq"><div><div className="section-kicker">GOOD QUESTIONS</div><h2>A little more<br /><span>clarity.</span></h2></div><div className="faq-list"><details><summary>How does matching work?<span>+</span></summary><p>We compare your stated preferences for budget, area, lifestyle, move-in timing, and room type. Each factor is shown openly on a profile.</p></details><details><summary>Is ROOMIE free to join?<span>+</span></summary><p>You can create a profile and explore the community after signing up. Any future paid features will be clearly marked.</p></details><details><summary>How do you help keep people safe?<span>+</span></summary><p>We encourage users to chat first and meet in public. You can report or block a profile at any time. Verification badges are only granted after review.</p></details></div></section>

      <footer className="site-footer"><Link className="brand" to="/"><span className="brand-mark">r</span>roomie<span className="brand-dot">.</span></Link><span>Find a place. Find your people.</span><div><Link to="/safety">Help & safety</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/login">Log in</Link></div><small>© {new Date().getFullYear()} ROOMIE. Made for better living together.</small></footer>
    </main>
  )
}
