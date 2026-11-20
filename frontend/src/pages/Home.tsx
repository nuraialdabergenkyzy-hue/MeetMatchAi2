import { Link } from "react-router-dom";
import {
  BrainCircuit,
  FilePenLine,
  MessagesSquare,
  Sparkles,
  Layers,
  HeartHandshake,
  Orbit,
  Target,
  Send,
  Languages,
  Quote,
  UsersRound,
} from "lucide-react";
import { useI18n } from "../hooks/useI18n";
import { useAuth } from "../hooks/useAuth";
import { isDemoAuthMode } from "../lib/env";
import { MatchCard } from "../components/MatchCard";
import { demoMatches } from "../services/mockApi";
export default function Home() {
  const { t } = useI18n(),
    { session } = useAuth();
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={16} />
            {t("home.eyebrow")}
          </div>
          <h1>{t("home.hero.title")}</h1>
          <p className="hero-description">{t("home.hero.subtitle")}</p>
          <div className="actions hero-actions">
            <Link
              className="btn btn-primary"
              to={isDemoAuthMode || session ? "/onboarding" : "/register"}
            >
              {t("home.hero.cta")}
            </Link>
            <a className="btn btn-secondary" href="#how-it-works">
              {t("home.how")}
            </a>
          </div>
          <div className="hero-note">
            <span className="mini-avatars" aria-hidden="true">
              <span>AI</span>
              <span>UX</span>
              <span>DEV</span>
            </span>
            <span>{t("home.step1.desc")}</span>
          </div>
        </div>
        <div className="connection-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <svg className="connection-lines" viewBox="0 0 500 440">
            <path d="M250 220L95 105M250 220L400 92M250 220L440 285M250 220L120 355M250 220L275 410" />
          </svg>
          <div className="connection-core">
            <BrainCircuit size={48} />
            <strong>MeetMatch AI</strong>
            <span>{t("home.mutual")}</span>
          </div>
          <div className="orbit-person person-one">
            <span>UX</span>
            <small>Design</small>
          </div>
          <div className="orbit-person person-two">
            <span>AI</span>
            <small>Technology</small>
          </div>
          <div className="orbit-person person-three">
            <span>PM</span>
            <small>Product</small>
          </div>
          <div className="orbit-person person-four">
            <span>DEV</span>
            <small>Engineering</small>
          </div>
          <div className="art-caption">
            <HeartHandshake size={19} />
            {t("home.eyebrow")}
          </div>
        </div>
      </section>
      <section className="container stats-section">
        <div className="stats">
          <div>
            <strong>150+</strong>
            <span>{t("home.stats.profiles")}</span>
          </div>
          <div>
            <strong>5</strong>
            <span>{t("home.stats.matches")}</span>
          </div>
          <div>
            <strong>&lt; 3s</strong>
            <span>{t("home.stats.time")}</span>
          </div>
        </div>
        <p className="hint text-center">{t("home.stats.note")}</p>
      </section>
      <section className="section container" id="how-it-works">
        <div className="section-heading">
          <span className="eyebrow">Meet · Match · Connect</span>
          <h2>{t("home.how")}</h2>
        </div>
        <div className="three-grid">
          {[FilePenLine, BrainCircuit, MessagesSquare].map((Icon, i) => (
            <div className="card feature-card" key={i}>
              <span className="feature-icon">
                <Icon />
              </span>
              <h3>{t(`home.step${i + 1}`)}</h3>
              <p className="muted">{t(`home.step${i + 1}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="section container">
        <div className="section-heading">
          <h2>{t("home.benefits")}</h2>
        </div>
        <div className="four-grid">
          {[
            [Layers, "skill"],
            [Orbit, "interest"],
            [Sparkles, "experience"],
            [Target, "mutual"],
          ].map(([Icon, key]) => {
            const I = Icon as typeof Layers;
            return (
              <div className="benefit" key={String(key)}>
                <I className="text-accent" />
                <h3>{t(`home.${key}`)}</h3>
                <p className="muted">{t(`home.${key}.desc`)}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="section container">
        <div className="section-heading">
          <h2>{t("home.samples")}</h2>
          <p className="muted">{t("demo.api")}</p>
        </div>
        <div className="match-grid">
          {demoMatches.slice(0, 2).map((m, i) => (
            <MatchCard key={m.id} match={m} variant="sample" index={i} />
          ))}
        </div>
      </section>
      <section className="section container" id="features">
        <div className="section-heading">
          <h2>{t("home.features")}</h2>
        </div>
        <div className="three-grid">
          {[
            [FilePenLine, "home.step1"],
            [UsersRound, "home.step2"],
            [BrainCircuit, "matches.reason"],
            [Quote, "matches.icebreaker"],
            [Send, "dashboard.telegram"],
            [Languages, "home.languages"],
          ].map(([Icon, key]) => {
            const I = Icon as typeof Send;
            return (
              <div className="card feature-tile" key={String(key)}>
                <I />
                <strong>{t(String(key))}</strong>
                {key === "dashboard.telegram" && (
                  <span className="badge">{t("common.soon")}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
