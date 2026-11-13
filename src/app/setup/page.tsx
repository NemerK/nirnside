import { Card, PageHeader } from "@/components/ui";
import { SetupPanel } from "@/components/setup-panel";
import { ModulesPanel } from "@/components/modules-panel";
import { LookSwitch } from "@/components/look-switch";
import { LookToggle } from "@/components/look-toggle";
import { AtlasSection } from "@/components/atlas/section";
import { getSetupStatus } from "@/lib/setup/status";
import { getDisabledModules, TOGGLEABLE_MODULES } from "@/lib/modules";
import { LOOKS } from "@/lib/look";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const status = getSetupStatus();
  const modules = <ModulesPanel modules={TOGGLEABLE_MODULES} disabled={getDisabledModules()} />;
  const setup = <SetupPanel initial={status} />;

  const lookCard = (
    <Card className="space-y-3 p-4">
      <div>
        <h2 className="text-sm font-semibold text-fg">App look</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Classic keeps the original flat sidebar. Atlas regroups navigation by how the data lives — account,
          characters, catalog, planning — without changing your snapshots.
        </p>
      </div>
      <LookToggle />
      <ul className="space-y-2 text-xs text-fg-subtle">
        {LOOKS.map((look) => (
          <li key={look.id}>
            <span className="font-medium text-fg-muted">{look.label}:</span> {look.blurb}
          </li>
        ))}
      </ul>
    </Card>
  );

  return (
    <LookSwitch
      classic={
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            title="Setup"
            subtitle="Tell Nirnside where ESO keeps your data. It installs its own addons and reads the files the game writes — nothing is uploaded."
          />
          {lookCard}
          {setup}
          {modules}
        </div>
      }
      atlas={
        <AtlasSection
          title="Setup"
          subtitle="Local machine only — find ESO, install addons, choose modules and look. Nothing is uploaded."
        >
          <div className="mx-auto max-w-3xl space-y-6">
            {lookCard}
            {setup}
            {modules}
          </div>
        </AtlasSection>
      }
    />
  );
}
