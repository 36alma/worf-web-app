import {getTranslations} from 'next-intl/server';
import PendingWitnessCard from '@/components/groups/minutes/PendingWitnessCard';
import {DashboardProvider} from '@/components/dashboard/DashboardProvider';
import DashboardKpis from '@/components/dashboard/DashboardKpis';
import WelcomeCard from '@/components/dashboard/WelcomeCard';
import MyTasksCard from '@/components/dashboard/MyTasksCard';
import UpcomingEventsCard from '@/components/dashboard/UpcomingEventsCard';
import ActivityCard from '@/components/dashboard/ActivityCard';
import QuickActionsCard from '@/components/dashboard/QuickActionsCard';

/**
 * Every widget loads on its own (skeleton and error state included), so one slow or failing endpoint only takes
 * down its own card. The provider shares the one summary request and queues the refetches after a save.
 */
export default async function DashboardPage() {
  const t = await getTranslations('dashboard');

  return (
    <DashboardProvider>
      <div className="mx-auto max-w-[1600px] space-y-6">
        <h1 className="text-title text-fg">{t('title')}</h1>

        <DashboardKpis />

        <WelcomeCard />

        <PendingWitnessCard />

        <div className="grid gap-4 xl:grid-cols-2">
          <MyTasksCard />
          <UpcomingEventsCard />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ActivityCard />
          <QuickActionsCard />
        </div>
      </div>
    </DashboardProvider>
  );
}
