import { SetupPanel } from "@/components/setup-panel";
import { ModulesPanel } from "@/components/modules-panel";
import { AtlasSection } from "@/components/atlas/section";
import { getSetupStatus } from "@/lib/setup/status";
import { getDisabledModules, TOGGLEABLE_MODULES } from "@/lib/modules";
import { HealthPanel } from "@/components/health-panel";
import { dataHealth } from "@/lib/db/health";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const status = getSetupStatus();
  const modules = <ModulesPanel modules={TOGGLEABLE_MODULES} disabled={getDisabledModules()} />;
  const setup = <SetupPanel initial={status} />;
  let health: ReturnType<typeof dataHealth> = [];
  try {
    health = dataHealth();
  } catch {
    health = [];
  }


  return (
    <AtlasSection
          title="Setup"
          subtitle="Local machine only — find ESO, install addons, choose modules. Nothing is uploaded."
        >
          <div className="mx-auto max-w-3xl space-y-6">
            {health.length ? <HealthPanel checks={health} /> : null}
            {setup}
            {modules}
          </div>
        </AtlasSection>
  );
}
