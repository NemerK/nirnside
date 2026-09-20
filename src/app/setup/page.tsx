import { PageHeader } from "@/components/ui";
import { SetupPanel } from "@/components/setup-panel";
import { getSetupStatus } from "@/lib/setup/status";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const status = getSetupStatus();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Setup"
        subtitle="Tell Nirnside where ESO keeps your data. It installs its own addons and reads the files the game writes — nothing is uploaded."
      />
      <SetupPanel initial={status} />
    </div>
  );
}
