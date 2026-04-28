'use client';

import { useEffect, useState } from 'react';
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

export default function Home() {
  const [data, setData] = useState<TasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLater, setShowLater] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    load();
  }, []);

  async function load() {
    try {
      const result = await api('/api/tasks');
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function complete(id: number) {
    haptic('success');
    setToast('Արեցիր 🔥');
    setTimeout(() => setToast(null), 2000);
    try {
      await api(`/api/tasks/${id}/complete`, { method: 'POST' });
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function skip(id: number) {
    haptic('light');
    try {
      await api(`/api/tasks/${id}/skip`, { method: 'POST' });
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-tg-hint">
        Բեռնում...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-tg-hint p-6 text-center">
        Չհաջողվեց բեռնել։ Փակիր ու բացիր նորից։
      </div>
    );
  }

  const isEmpty = !data.now && data.nearby.length === 0 && data.later.length === 0;

  return (
    <main className="min-h-screen px-4 py-5 max-w-md mx-auto">
      {/* Stats badge */}
      <div className="flex items-center justify-between mb-6 text-sm">
        <div className="text-tg-hint">
          Արել ես <span className="text-tg-text font-semibold">{data.stats.total_completed}</span>
          <span className="mx-1">/</span>
          {data.stats.total_captured}
        </div>
        <div className="text-tg-hint">
          🔥 <span className="text-tg-text font-semibold">{data.stats.current_streak}</span> օր
        </div>
      </div>

      {isEmpty && <EmptyState />}

      {/* Now */}
      {data.now && (
        <section className="mb-8">
          <h2 className="text-tg-hint text-xs uppercase tracking-wider mb-2">Հիմա</h2>
          <NowCard task={data.now} onComplete={complete} onSkip={skip} />
        </section>
      )}

      {/* Nearby */}
      {data.nearby.length > 0 && (
        <section className="mb-8">
          <h2 className="text-tg-hint text-xs uppercase tracking-wider mb-2">Մերձակա</h2>
          <ul className="space-y-2">
            {data.nearby.map((t) => (
              <TaskRow key={t.id} task={t} onComplete={complete} />
            ))}
          </ul>
        </section>
      )}

      {/* Later (collapsible) */}
      {data.later.length > 0 && (
        <section>
          <button
            onClick={() => setShowLater((v) => !v)}
            className="text-tg-hint text-xs uppercase tracking-wider mb-2 flex items-center gap-1"
          >
            Հետո ({data.later.length}) {showLater ? '▾' : '▸'}
          </button>
          {showLater && (
            <ul className="space-y-2">
              {data.later.map((t) => (
                <TaskRow key={t.id} task={t} onComplete={complete} />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-tg-text text-tg-bg px-4 py-2 rounded-full text-sm shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

function NowCard({
  task,
  onComplete,
  onSkip,
}: {
  task: Task;
  onComplete: (id: number) => void;
  onSkip: (id: number) => void;
}) {
  const tag = task.location_tag || 'other';
  const ageText =
    task._age_days < 1
      ? 'այսօր'
      : task._age_days < 2
        ? 'երեկվանից'
        : `${Math.floor(task._age_days)} օր է`;

  return (
    <div className="bg-tg-secondaryBg rounded-2xl p-5">
      <div className="flex items-center gap-2 text-tg-hint text-xs mb-3">
        <span>{tagEmoji[tag]}</span>
        <span>{tagLabel[tag]}</span>
        <span>·</span>
        <span>~{task.estimated_minutes} րոպե</span>
        <span>·</span>
        <span>{ageText}</span>
      </div>
      <div className="text-xl font-medium mb-5">{task.title}</div>
      <div className="flex gap-2">
        <button
          onClick={() => onComplete(task.id)}
          className="flex-1 bg-tg-button text-tg-buttonText py-3 rounded-xl font-medium active:opacity-80"
        >
          ✓ Արեցի
        </button>
        <button
          onClick={() => onSkip(task.id)}
          className="px-4 py-3 rounded-xl text-tg-hint border border-tg-hint/20 active:opacity-60"
        >
          Հաջորդը
        </button>
      </div>
    </div>
  );
}

function TaskRow({ task, onComplete }: { task: Task; onComplete: (id: number) => void }) {
  const tag = task.location_tag || 'other';
  return (
    <li className="flex items-center gap-3 py-2">
      <button
        onClick={() => onComplete(task.id)}
        className="w-6 h-6 rounded-full border-2 border-tg-hint/40 active:bg-tg-button/20 flex-shrink-0"
        aria-label="Արեցի"
      />
      <span className="text-base">{tagEmoji[tag]}</span>
      <span className="flex-1 text-sm">{task.title}</span>
      <span className="text-xs text-tg-hint">{task.estimated_minutes}ր</span>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 text-tg-hint">
      <div className="text-5xl mb-4">🎉</div>
      <div className="text-lg mb-2">Ամեն ինչ արված է</div>
      <div className="text-sm">Գրի՛ր bot-ին հաջորդ task-ը</div>
    </div>
  );
}
