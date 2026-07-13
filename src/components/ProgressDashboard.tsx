import React, { useMemo, useState } from 'react';
import { Activity, CalendarDays, Clock3, Target, TrendingUp } from 'lucide-react';
import {
  buildDailyProgress,
  currentPracticeStreak,
  loadPracticeEvents,
  SkillSummary,
  summarizeSkills,
} from '../lib/analytics';
import { loadStore, todayStr } from '../lib/srs';

const CHART_WIDTH = 760;
const CHART_HEIGHT = 260;
const CHART_PAD_X = 42;
const CHART_PAD_Y = 28;

function formatDuration(durationMs: number): string {
  const minutes = Math.round(durationMs / 60_000);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function shortDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function ScoreBar({ score, tone }: { score: number; tone: 'strong' | 'weak' }) {
  const barColor = tone === 'strong' ? 'bg-emerald-500' : 'bg-amber-500';
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function SkillList({
  title,
  skills,
  tone,
  emptyText,
}: {
  title: string;
  skills: SkillSummary[];
  tone: 'strong' | 'weak';
  emptyText: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
          tone === 'strong' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
        }`}>
          Recent weighted
        </span>
      </div>
      {skills.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">{emptyText}</p>
      ) : (
        <div className="space-y-4">
          {skills.map(skill => (
            <div key={`${skill.module}-${skill.topic}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{skill.topic}</p>
                  <p className="text-xs text-slate-400">{skill.module} · {skill.attempts} tracked</p>
                </div>
                <span className={`text-sm font-bold ${
                  tone === 'strong' ? 'text-emerald-700' : 'text-amber-800'
                }`}>
                  {skill.recentScore}
                </span>
              </div>
              <ScoreBar score={skill.recentScore} tone={tone} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ProgressDashboard() {
  const [range, setRange] = useState(30);
  const events = useMemo(() => loadPracticeEvents(), []);
  const srsRecords = useMemo(() => Object.values(loadStore()), []);
  const daily = useMemo(() => buildDailyProgress(events, range), [events, range]);
  const skillSummaries = useMemo(() => summarizeSkills(events), [events]);

  const practicedDays = new Set(events.map(event => event.practiceDate)).size;
  const averageScore = events.length
    ? Math.round(events.reduce((total, event) => total + event.score, 0) / events.length)
    : 0;
  const trackedDuration = events.reduce((total, event) => total + (event.durationMs ?? 0), 0);
  const lifetimeReviews = srsRecords.reduce((total, record) => total + record.totalSeen, 0);
  const lifetimeCorrect = srsRecords.reduce((total, record) => total + record.totalCorrect, 0);
  const mastered = srsRecords.filter(record => record.repetitions >= 3).length;
  const due = srsRecords.filter(record => record.dueDate <= todayStr()).length;
  const streak = currentPracticeStreak(events);

  const reliableSkills = skillSummaries.filter(skill => skill.attempts >= 2);
  const rankedPool = reliableSkills.length > 0 ? reliableSkills : skillSummaries;
  const strengths = [...rankedPool]
    .filter(skill => skill.recentScore >= 75)
    .sort((a, b) => b.recentScore - a.recentScore || b.attempts - a.attempts)
    .slice(0, 5);
  const weaknesses = [...rankedPool]
    .filter(skill => skill.recentScore < 75)
    .sort((a, b) => a.recentScore - b.recentScore || b.attempts - a.attempts)
    .slice(0, 5);

  const plotWidth = CHART_WIDTH - CHART_PAD_X * 2;
  const plotHeight = CHART_HEIGHT - CHART_PAD_Y * 2;
  const activePoints = daily.flatMap((day, index) => day.score === null ? [] : [{
    x: CHART_PAD_X + (index / Math.max(1, daily.length - 1)) * plotWidth,
    y: CHART_PAD_Y + ((100 - day.score) / 100) * plotHeight,
    ...day,
  }]);
  const pointString = activePoints.map(point => `${point.x},${point.y}`).join(' ');
  const labelEvery = Math.max(1, Math.floor(daily.length / 5));

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,_#ecfeff_0,_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-teal-700">Practice intelligence</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">Your Progress</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Proficiency rewards clean first attempts. Retries, revealed answers, and trainer misses
              lower the score so improvement reflects recall rather than eventual completion.
            </p>
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {[14, 30, 90].map(days => (
              <button
                key={days}
                onClick={() => setRange(days)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  range === days ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Tracked work', value: events.length, note: `${practicedDays} practice days`, icon: Activity },
            { label: 'Proficiency', value: events.length ? `${averageScore}%` : '—', note: 'retry weighted', icon: Target },
            { label: 'Current streak', value: `${streak}d`, note: 'daily practice', icon: CalendarDays },
            { label: 'Tracked time', value: events.length ? formatDuration(trackedDuration) : '—', note: 'active answers', icon: Clock3 },
            { label: 'Mastered', value: mastered, note: `${due} currently due`, icon: TrendingUp },
          ].map(metric => (
            <div key={metric.label} className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
              <metric.icon className="mb-3 h-4 w-4 text-teal-600" />
              <p className="text-2xl font-bold text-slate-950">{metric.value}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">{metric.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{metric.note}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900">Proficiency trend</h3>
              <p className="text-xs text-slate-400">Daily average · 0–100</p>
            </div>
            <p className="text-xs text-slate-400">
              Lifetime SRS: {lifetimeCorrect}/{lifetimeReviews} correct reviews
            </p>
          </div>
          {activePoints.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
              <div>
                <TrendingUp className="mx-auto mb-3 h-7 w-7 text-slate-300" />
                <p className="font-medium text-slate-600">Your line begins with the next completed exercise.</p>
                <p className="mt-1 text-xs text-slate-400">Existing SRS totals are preserved above as a lifetime baseline.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="min-w-[620px]" role="img" aria-label="Daily proficiency line chart">
                {[0, 25, 50, 75, 100].map(score => {
                  const y = CHART_PAD_Y + ((100 - score) / 100) * plotHeight;
                  return (
                    <g key={score}>
                      <line x1={CHART_PAD_X} x2={CHART_WIDTH - CHART_PAD_X} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                      <text x={CHART_PAD_X - 9} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{score}</text>
                    </g>
                  );
                })}
                {daily.map((day, index) => {
                  if (index % labelEvery !== 0 && index !== daily.length - 1) return null;
                  const x = CHART_PAD_X + (index / Math.max(1, daily.length - 1)) * plotWidth;
                  return <text key={day.date} x={x} y={CHART_HEIGHT - 5} textAnchor="middle" className="fill-slate-400 text-[10px]">{shortDate(day.date)}</text>;
                })}
                {activePoints.length > 1 && (
                  <polyline points={pointString} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {activePoints.map(point => (
                  <circle key={point.date} cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#0f766e" strokeWidth="3">
                    <title>{point.date}: {point.score} proficiency · {point.count} exercises</title>
                  </circle>
                ))}
              </svg>
            </div>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <SkillList
            title="Strongest skills"
            skills={strengths}
            tone="strong"
            emptyText="Complete a few exercises to reveal your strongest skills."
          />
          <SkillList
            title="Needs attention"
            skills={weaknesses}
            tone="weak"
            emptyText="Weaknesses will appear after your first tracked attempts."
          />
        </section>

        <p className="pb-4 text-center text-xs text-slate-400">
          Progress is private to this browser. Historical tracking begins with this version of Harmony Hub.
        </p>
      </div>
    </main>
  );
}
