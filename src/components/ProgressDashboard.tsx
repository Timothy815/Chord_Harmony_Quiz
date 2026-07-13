import React, { useMemo, useState } from 'react';
import { Activity, CalendarDays, Clock3, Target, TrendingUp } from 'lucide-react';
import {
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
  selectedKey,
  onSelect,
}: {
  title: string;
  skills: SkillSummary[];
  tone: 'strong' | 'weak';
  emptyText: string;
  selectedKey: string | null;
  onSelect: (skill: SkillSummary) => void;
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
            <button
              key={`${skill.module}-${skill.topic}`}
              onClick={() => onSelect(skill)}
              className={`block w-full rounded-xl p-2 text-left transition-colors ${
                selectedKey === `${skill.module}\u0000${skill.topic}`
                  ? 'bg-teal-50 ring-1 ring-teal-200'
                  : 'hover:bg-slate-50'
              }`}
            >
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
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function ProgressDashboard() {
  const [attemptRange, setAttemptRange] = useState(25);
  const [requestedSkillKey, setRequestedSkillKey] = useState<string | null>(null);
  const events = useMemo(() => loadPracticeEvents(), []);
  const srsRecords = useMemo(() => Object.values(loadStore()), []);
  const skillSummaries = useMemo(() => summarizeSkills(events), [events]);

  const practicedDays = new Set(events.map(event => event.practiceDate)).size;
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

  const selectableSkills = [...skillSummaries]
    .sort((a, b) => a.module.localeCompare(b.module) || a.topic.localeCompare(b.topic));
  const defaultSkill = [...skillSummaries].sort((a, b) => b.attempts - a.attempts)[0] ?? null;
  const selectedSkill = skillSummaries.find(
    skill => `${skill.module}\u0000${skill.topic}` === requestedSkillKey
  ) ?? defaultSkill;
  const selectedSkillKey = selectedSkill
    ? `${selectedSkill.module}\u0000${selectedSkill.topic}`
    : null;
  const allSelectedEvents = selectedSkill
    ? events.filter(event => event.module === selectedSkill.module && event.topic === selectedSkill.topic)
    : [];
  const selectedEvents = allSelectedEvents.slice(-attemptRange);
  const firstAttemptNumber = allSelectedEvents.length - selectedEvents.length + 1;
  const selectedAverage = selectedEvents.length
    ? Math.round(selectedEvents.reduce((total, event) => total + event.score, 0) / selectedEvents.length)
    : null;
  const selectedBest = selectedEvents.length
    ? Math.max(...selectedEvents.map(event => event.score))
    : null;
  const selectedChange = selectedEvents.length > 1
    ? selectedEvents[selectedEvents.length - 1].score - selectedEvents[0].score
    : null;

  const plotWidth = CHART_WIDTH - CHART_PAD_X * 2;
  const plotHeight = CHART_HEIGHT - CHART_PAD_Y * 2;
  const activePoints = selectedEvents.map((event, index) => ({
    x: selectedEvents.length === 1
      ? CHART_PAD_X + plotWidth / 2
      : CHART_PAD_X + (index / (selectedEvents.length - 1)) * plotWidth,
    y: CHART_PAD_Y + ((100 - event.score) / 100) * plotHeight,
    event,
    attemptNumber: firstAttemptNumber + index,
  }));
  const pointString = activePoints.map(point => `${point.x},${point.y}`).join(' ');
  const labelEvery = Math.max(1, Math.floor(selectedEvents.length / 6));

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,_#ecfeff_0,_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-teal-700">Practice intelligence</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">Your Progress</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Proficiency rewards clean first attempts. Retries, revealed answers, and trainer misses
              lower the score so improvement reflects recall rather than eventual completion.
            </p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Tracked work', value: events.length, note: `${practicedDays} practice days`, icon: Activity },
            { label: 'Skills tracked', value: skillSummaries.length, note: 'individual trends', icon: Target },
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
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">Skill proficiency trend</h3>
              <p className="text-xs text-slate-400">One point per completed exercise · 0–100</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-500" htmlFor="progress-skill">Skill</label>
              <select
                id="progress-skill"
                value={selectedSkillKey ?? ''}
                onChange={event => setRequestedSkillKey(event.target.value || null)}
                disabled={selectableSkills.length === 0}
                className="max-w-[18rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-teal-500 disabled:text-slate-300"
              >
                {selectableSkills.length === 0 && <option value="">No tracked skills yet</option>}
                {selectableSkills.map(skill => {
                  const key = `${skill.module}\u0000${skill.topic}`;
                  return <option key={key} value={key}>{skill.module} · {skill.topic}</option>;
                })}
              </select>
              <span className="text-xs text-slate-400">Last</span>
              <div className="flex rounded-lg bg-slate-100 p-1" aria-label="Number of skill attempts to chart">
                {[10, 25, 50].map(count => (
                  <button
                    key={count}
                    onClick={() => setAttemptRange(count)}
                    title={`Show the last ${count} attempts`}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      attemptRange === count ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-white'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {selectedSkill && (
            <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 text-xs">
              <p><span className="text-slate-400">Selected</span> <strong className="ml-1 text-slate-700">{selectedSkill.topic}</strong></p>
              <p><span className="text-slate-400">Shown average</span> <strong className="ml-1 text-teal-700">{selectedAverage}</strong></p>
              <p><span className="text-slate-400">Best</span> <strong className="ml-1 text-slate-700">{selectedBest}</strong></p>
              <p>
                <span className="text-slate-400">First-to-last</span>{' '}
                <strong className={`ml-1 ${
                  selectedChange === null || selectedChange === 0
                    ? 'text-slate-600'
                    : selectedChange > 0 ? 'text-emerald-700' : 'text-red-600'
                }`}>
                  {selectedChange === null ? '—' : `${selectedChange > 0 ? '+' : ''}${selectedChange}`}
                </strong>
              </p>
              <p><span className="text-slate-400">Lifetime attempts</span> <strong className="ml-1 text-slate-700">{allSelectedEvents.length}</strong></p>
            </div>
          )}
          {activePoints.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
              <div>
                <TrendingUp className="mx-auto mb-3 h-7 w-7 text-slate-300" />
                <p className="font-medium text-slate-600">A skill line begins with its first completed exercise.</p>
                <p className="mt-1 text-xs text-slate-400">Lifetime SRS: {lifetimeCorrect}/{lifetimeReviews} correct reviews before detailed tracking.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="min-w-[620px]" role="img" aria-label={`${selectedSkill?.topic ?? 'Skill'} attempt score line chart`}>
                {[0, 25, 50, 75, 100].map(score => {
                  const y = CHART_PAD_Y + ((100 - score) / 100) * plotHeight;
                  return (
                    <g key={score}>
                      <line x1={CHART_PAD_X} x2={CHART_WIDTH - CHART_PAD_X} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                      <text x={CHART_PAD_X - 9} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{score}</text>
                    </g>
                  );
                })}
                {activePoints.map((point, index) => {
                  if (index % labelEvery !== 0 && index !== activePoints.length - 1) return null;
                  return <text key={point.event.id} x={point.x} y={CHART_HEIGHT - 5} textAnchor="middle" className="fill-slate-400 text-[10px]">#{point.attemptNumber}</text>;
                })}
                {activePoints.length > 1 && (
                  <polyline points={pointString} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {activePoints.map(point => (
                  <circle
                    key={point.event.id}
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    fill={point.event.score >= 75 ? '#10b981' : point.event.score >= 50 ? '#f59e0b' : '#ef4444'}
                    stroke="#fff"
                    strokeWidth="2"
                  >
                    <title>
                      Attempt {point.attemptNumber} · {shortDate(point.event.practiceDate)} · score {point.event.score} · {point.event.attempts} {point.event.attempts === 1 ? 'try' : 'tries'}
                    </title>
                  </circle>
                ))}
              </svg>
            </div>
          )}
          {activePoints.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <p>Hover a point for its date, score, and number of tries.</p>
              <p><span className="text-emerald-600">●</span> 75+ <span className="ml-2 text-amber-500">●</span> 50–74 <span className="ml-2 text-red-500">●</span> below 50</p>
            </div>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <SkillList
            title="Strongest skills"
            skills={strengths}
            tone="strong"
            emptyText="Complete a few exercises to reveal your strongest skills."
            selectedKey={selectedSkillKey}
            onSelect={skill => setRequestedSkillKey(`${skill.module}\u0000${skill.topic}`)}
          />
          <SkillList
            title="Needs attention"
            skills={weaknesses}
            tone="weak"
            emptyText="Weaknesses will appear after your first tracked attempts."
            selectedKey={selectedSkillKey}
            onSelect={skill => setRequestedSkillKey(`${skill.module}\u0000${skill.topic}`)}
          />
        </section>

        <p className="pb-4 text-center text-xs text-slate-400">
          Progress is private to this browser. Historical tracking begins with this version of Harmony Hub.
        </p>
      </div>
    </main>
  );
}
