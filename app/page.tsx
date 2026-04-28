'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, haptic } from '@/lib/tg';

type Task = {
  id: number;
  title: string;
  location_tag: string | null;
  estimated_minutes: number;
  urgency: number;
  created_at: string;
  _age_days: number;
};

type CompletedTask = {
  id: number;
  title: string;
  location_tag: string | null;
  estimated_minutes: number;
  urgency: number;
  completed_at: string;
  created_at: string;
};

type Stats = {
  total_captured: number;
  total_completed: number;
  current_streak: number;
  longest_streak: number;
};

type TasksResponse = {
  now: Task | null;
  nearby: Task[];
  later: Task[];
  stats: Stats;
};

const tagEmoji: Record<string, string> = {
  shop: '🛒',
  bank: '🏦',
  pharmacy: '💊',
  post: '📮',
  home: '🏠',
  office: '🏢',
  call: '📞',
  online: '💻',
  other: '📌',
};

const tagLabel: Record<string, string> = {
  shop: 'Խանութ',
  bank: 'Բանկ',
  pharmacy: 'Դեղատուն',
  post: 'Փոստ',
  home: 'Տուն',
  office: 'Գրասենյակ',
  call: 'Զանգ',
  online: 'Օնլայն',
  other: 'Այլ',
};

const armenianMonths = [
  'Հունվ', 'Փետ', 'Մարտ', 'Ապր', 'Մայ', 'Հուն',
  'Հուլ', 'Օգ', 'Սեպ', 'Հոկ', 'Նոյ', 'Դեկ',
];

function ageBarColor(days: number): string {
  if (days < 1) return '#22c55e';
  if (days < 3) return 'var(--tg-theme-button-color, #2481cc)';
  if (days < 7) return '#f97316';
  return '#ef4444';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('hy-AM', { hour: '2-digit', minute: '2-digit' });
}

function groupByDay(tasks: CompletedTask[]): { label: string; items: CompletedTask[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const groups = new Map<string, CompletedTask[]>();

  for (const t of tasks) {
    const d = new Date(t.completed_at);
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = 'Այսօր';
    else if (d.getTime() === yesterday.getTime()) label = 'Երեկ';
    else if (d >= weekAgo) label = 'Այս շաբաթ';
    else label = `${armenianMonths[d.getMonth()]} ${d.getDate()}`;

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(t);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function useCountUp(target: number): number {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = target;
    if (prev === target) return;
    const start = Date.now();
    const duration = 600;
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(prev + (target - prev) * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);

  return value;
}

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

export default function Home() {
  const [data, setData] = useState<TasksResponse | null>(null);
  const [completedToday, setCompletedToday] = useState<CompletedTask[]>([]);
  const [allCompleted, setAllCompleted] = useState<CompletedTask[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLater, setShowLater] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [view, setView] = useState<'tasks' | 'history'>('tasks');
  const [toast, setToast] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    load();
  }, []);

  useEffect(() => {
    if (view === 'history' && allCompleted === null) {
      loadHistory();
    }
  }, [view, allCompleted]);

  async function load() {
    try {
      const [tasksResult, completedResult] = await Promise.all([
        api('/api/tasks'),
        api('/api/tasks/completed?range=today'),
      ]);
      setData(tasksResult);
      setCompletedToday(completedResult.tasks);
      setAllCompleted(null); // invalidate so history refreshes on next switch
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const result = await api('/api/tasks/completed?range=all');
      setAllCompleted(result.tasks);
    } catch (e) {
      console.error(e);
    }
  }

  async function complete(id: number) {
    haptic('success');
    setCompleting(true);
    setToast('Արեցիր 🔥');
    setTimeout(() => setToast(null), 2500);
    try {
      await api(`/api/tasks/${id}/complete`, { method: 'POST' });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setCompleting(false);
    }
  }

  async function skip(id: number) {
    haptic('light');
    setSkipping(true);
    try {
      await api(`/api/tasks/${id}/skip`, { method: 'POST' });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSkipping(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-tg-hint text-sm">
        Բեռնում...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-tg-hint p-6 text-center text-sm">
        Չհաջողվեց բեռնել։ Փակիր ու բացիր նորից։
      </div>
    );
  }

  const isEmpty = !data.now && data.nearby.length === 0 && data.later.length === 0;

  return (
    <main className="min-h-screen px-4 py-5 max-w-md mx-auto">
      {/* Stats */}
      <StatsBar stats={data.stats} todayCount={completedToday.length} />

      {/* View toggle */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-tg-secondaryBg">
        {(['tasks', 'history'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-1.5 rounded-lg text-sm transition-all duration-150 ${
              view === v
                ? 'bg-tg-bg text-tg-text font-medium shadow-sm'
                : 'text-tg-hint'
            }`}
          >
            {v === 'tasks' ? 'Ցուցակ' : 'Պատմություն'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {view === 'tasks' ? (
          <motion.div
            key="tasks"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {isEmpty && !skipping && <EmptyState todayCount={completedToday.length} />}

            {/* Now */}
            {(data.now || skipping) && (
              <section className="mb-8">
                <h2 className="text-tg-hint text-xs uppercase tracking-widest mb-3 font-medium">
                  Հիմա
                </h2>
                <AnimatePresence mode="wait">
                  {skipping ? (
                    <NowCardSkeleton key="skeleton" />
                  ) : (
                    data.now && (
                      <NowCard
                        key={data.now.id}
                        task={data.now}
                        onComplete={complete}
                        onSkip={skip}
                        busy={completing}
                      />
                    )
                  )}
                </AnimatePresence>
              </section>
            )}

            {/* Nearby */}
            {data.nearby.length > 0 && (
              <section className="mb-7">
                <h2 className="text-tg-hint text-xs uppercase tracking-widest mb-3 font-medium">
                  Մերձակա
                </h2>
                <motion.ul
                  variants={listVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-0.5"
                >
                  {data.nearby.map((t) => (
                    <motion.li key={t.id} variants={itemVariants}>
                      <TaskRow task={t} onComplete={complete} />
                    </motion.li>
                  ))}
                </motion.ul>
              </section>
            )}

            {/* Later */}
            {data.later.length > 0 && (
              <section className="mb-7">
                <button
                  onClick={() => setShowLater((v) => !v)}
                  className="flex items-center gap-1.5 text-tg-hint text-xs uppercase tracking-widest mb-3 font-medium"
                >
                  Հետո ({data.later.length})
                  <span className="text-[10px] opacity-50">{showLater ? '▾' : '▸'}</span>
                </button>
                <AnimatePresence>
                  {showLater && (
                    <motion.ul
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-0.5 overflow-hidden"
                    >
                      {data.later.map((t) => (
                        <TaskRow key={t.id} task={t} onComplete={complete} />
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </section>
            )}

            {/* Done today */}
            {completedToday.length > 0 && (
              <section className="mt-2 pt-5 border-t border-tg-hint/10">
                <button
                  onClick={() => setShowDone((v) => !v)}
                  className="flex items-center gap-1.5 text-tg-hint text-xs uppercase tracking-widest mb-3 font-medium"
                >
                  Արված այսօր ({completedToday.length})
                  <span className="text-[10px] opacity-50">{showDone ? '▾' : '▸'}</span>
                </button>
                <AnimatePresence>
                  {showDone && (
                    <motion.ul
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-0.5 overflow-hidden"
                    >
                      {completedToday.map((t) => (
                        <CompletedRow key={t.id} task={t} />
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </section>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <HistoryView tasks={allCompleted} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-tg-text text-tg-bg px-5 py-2.5 rounded-full text-sm font-medium shadow-lg whitespace-nowrap"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// TODO: make tappable to open a detailed stats screen
function StatsBar({ stats, todayCount }: { stats: Stats; todayCount: number }) {
  const completed = useCountUp(stats.total_completed);
  const streak = useCountUp(stats.current_streak);

  return (
    <div className="mb-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] text-tg-hint uppercase tracking-wider mb-1">Արված</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-tg-text">{completed}</span>
            <span className="text-tg-hint text-sm">/</span>
            <span className="text-tg-hint text-sm">{stats.total_captured}</span>
          </div>
          {stats.longest_streak > 0 && (
            <div className="text-[11px] text-tg-hint/50 mt-0.5">
              max {stats.longest_streak} օր
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-[11px] text-tg-hint uppercase tracking-wider mb-1">Շարան</div>
          <div className="flex items-baseline justify-end gap-1">
            {stats.current_streak > 0 && (
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, repeatDelay: 4, duration: 0.4 }}
                className="text-lg leading-none"
              >
                🔥
              </motion.span>
            )}
            <span className="text-2xl font-bold text-tg-text">{streak}</span>
            <span className="text-tg-hint text-sm">օր</span>
          </div>
        </div>
      </div>

      {todayCount > 0 && (
        <div className="flex items-center gap-1 mt-3">
          {Array.from({ length: Math.min(todayCount, 10) }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 20 }}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--tg-theme-button-color, #2481cc)', opacity: 0.6 }}
            />
          ))}
          {todayCount > 10 && (
            <span className="text-[11px] text-tg-hint/60">+{todayCount - 10}</span>
          )}
        </div>
      )}
    </div>
  );
}

function NowCard({
  task,
  onComplete,
  onSkip,
  busy,
}: {
  task: Task;
  onComplete: (id: number) => void;
  onSkip: (id: number) => void;
  busy: boolean;
}) {
  const tag = task.location_tag || 'other';
  const ageText =
    task._age_days < 1
      ? 'այսօր'
      : task._age_days < 2
        ? 'երեկ'
        : `${Math.floor(task._age_days)} օր`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -6 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--tg-theme-secondary-bg-color, #f4f4f5)' }}
    >
      {/* Accent line */}
      <div
        style={{
          height: 3,
          background: 'var(--tg-theme-button-color, #2481cc)',
          opacity: 0.75,
        }}
      />

      <div className="p-5">
        {/* Meta */}
        <div className="flex items-center gap-2 text-tg-hint text-xs mb-3">
          <span>{tagEmoji[tag] || '📌'}</span>
          <span>{tagLabel[tag] || 'Այլ'}</span>
          <span className="opacity-30">·</span>
          <span>~{task.estimated_minutes} րոպե</span>
          <span className="opacity-30">·</span>
          <span>{ageText}</span>
        </div>

        {/* Title */}
        <div className="text-[22px] font-semibold leading-snug mb-5">{task.title}</div>

        {/* Age bar */}
        <div
          className="h-[3px] rounded-full mb-5 overflow-hidden"
          style={{ background: 'rgba(128,128,128,0.1)' }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((task._age_days / 14) * 100, 100)}%` }}
            transition={{ delay: 0.25, duration: 0.7, ease: 'easeOut' }}
            style={{
              height: '100%',
              borderRadius: 9999,
              background: ageBarColor(task._age_days),
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onComplete(task.id)}
            disabled={busy}
            className="flex-1 bg-tg-button text-tg-buttonText py-3 rounded-xl font-medium active:opacity-80 transition-opacity disabled:opacity-50"
          >
            ✓ Արեցի
          </button>
          <button
            onClick={() => onSkip(task.id)}
            disabled={busy}
            className="px-5 py-3 rounded-xl text-tg-hint border border-tg-hint/20 active:opacity-60 transition-opacity disabled:opacity-40"
          >
            Հաջորդը
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function NowCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--tg-theme-secondary-bg-color, #f4f4f5)' }}
    >
      <div
        style={{
          height: 3,
          background: 'var(--tg-theme-button-color, #2481cc)',
          opacity: 0.25,
        }}
      />
      <div className="p-5">
        <div className="h-3 w-28 rounded-full bg-tg-hint/15 animate-pulse mb-3" />
        <div className="h-6 w-4/5 rounded-lg bg-tg-hint/15 animate-pulse mb-2" />
        <div className="h-4 w-2/3 rounded-lg bg-tg-hint/10 animate-pulse mb-5" />
        <div className="h-[3px] rounded-full bg-tg-hint/10 mb-5" />
        <div className="flex gap-2">
          <div className="flex-1 h-12 rounded-xl bg-tg-hint/15 animate-pulse" />
          <div className="w-24 h-12 rounded-xl bg-tg-hint/10 animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

function TaskRow({ task, onComplete }: { task: Task; onComplete: (id: number) => void }) {
  const tag = task.location_tag || 'other';
  return (
    <div className="flex items-center gap-3 py-2.5 px-1">
      <button
        onClick={() => onComplete(task.id)}
        className="w-5 h-5 rounded-full border-2 border-tg-hint/30 active:border-tg-button active:bg-tg-button/10 flex-shrink-0 transition-colors"
        aria-label="Արեցի"
      />
      <span className="text-sm opacity-60">{tagEmoji[tag] || '📌'}</span>
      <span className="flex-1 text-sm leading-snug">{task.title}</span>
      <span className="text-xs text-tg-hint/60 flex-shrink-0">{task.estimated_minutes}ր</span>
    </div>
  );
}

function CompletedRow({ task }: { task: CompletedTask }) {
  const tag = task.location_tag || 'other';
  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <span className="text-sm opacity-35">{tagEmoji[tag] || '📌'}</span>
      <span className="flex-1 text-sm text-tg-hint line-through opacity-55 leading-snug">
        {task.title}
      </span>
      <span className="text-xs text-tg-hint/45 flex-shrink-0">{formatTime(task.completed_at)}</span>
    </div>
  );
}

function HistoryView({ tasks }: { tasks: CompletedTask[] | null }) {
  if (tasks === null) {
    return (
      <div className="flex items-center justify-center py-16 text-tg-hint text-sm">
        Բեռնում...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-tg-hint gap-3 text-center">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="opacity-30">
          <rect x="4" y="10" width="32" height="24" rx="4" stroke="currentColor" strokeWidth="2" />
          <path d="M4 20h8l3 5h10l3-5h8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <span className="text-sm">Ավարտված առաջադրանք չկա</span>
      </div>
    );
  }

  const groups = groupByDay(tasks);

  return (
    <motion.div
      variants={listVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-6"
    >
      {groups.map(({ label, items }) => (
        <motion.section key={label} variants={itemVariants}>
          <h3 className="text-[11px] font-medium uppercase tracking-widest text-tg-hint mb-2">
            {label}
          </h3>
          <div
            className="rounded-xl overflow-hidden divide-y"
            style={{
              background: 'var(--tg-theme-secondary-bg-color, #f4f4f5)',
              borderColor: 'rgba(128,128,128,0.08)',
            }}
          >
            {items.map((t) => (
              <CompletedRow key={t.id} task={t} />
            ))}
          </div>
        </motion.section>
      ))}
    </motion.div>
  );
}

function EmptyState({ todayCount }: { todayCount: number }) {
  if (todayCount > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="text-center py-14"
      >
        <svg width="52" height="52" viewBox="0 0 52 52" className="mx-auto mb-4" fill="none">
          <circle
            cx="26"
            cy="26"
            r="22"
            stroke="var(--tg-theme-button-color, #2481cc)"
            strokeWidth="2"
            opacity="0.2"
          />
          <circle
            cx="26"
            cy="26"
            r="22"
            stroke="var(--tg-theme-button-color, #2481cc)"
            strokeWidth="2"
            strokeDasharray="138 138"
            strokeLinecap="round"
            transform="rotate(-90 26 26)"
          />
          <path
            d="M15 26l8 8 14-15"
            stroke="var(--tg-theme-button-color, #2481cc)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="text-base font-semibold text-tg-text mb-1">
          Այսօր արել ես {todayCount} բան
        </div>
        <div className="text-sm text-tg-hint">Ամեն ինչ արված է</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="text-center py-14"
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        className="mx-auto mb-4 opacity-25"
        fill="none"
      >
        <rect x="6" y="14" width="36" height="26" rx="4" stroke="currentColor" strokeWidth="2" />
        <path
          d="M6 26h9l3 5h12l3-5h9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M17 8l7 6 7-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="24" y1="4" x2="24" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="text-base font-medium text-tg-text mb-1">Ոչինչ չկա</div>
      <div className="text-sm text-tg-hint">Գրի՛ր bot-ին հաջորդ task-ը</div>
    </motion.div>
  );
}
