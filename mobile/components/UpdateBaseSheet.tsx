// mobile/components/UpdateBaseSheet.tsx — re-registers the base resume
// reusing BasePickStep (same flow as onboarding step 3, keeps the key).
import { ScrollView } from "react-native";
import { useTranslations } from "../lib/i18n-provider";
import { ModalShell } from "./ModalShell";
import { BasePickStep } from "./BasePickStep";

export function UpdateBaseSheet({ visible, onClose, onChanged }: { visible: boolean; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations("Base");
  return (
    <ModalShell visible={visible} onClose={onClose} title={t("updateTitle")}>
      <ScrollView>
        <BasePickStep
          title={t("updateTitle")}
          description={t("updateDesc")}
          submitLabel={t("updateSubmit")}
          onDone={() => {
            onChanged();
            onClose();
          }}
        />
      </ScrollView>
    </ModalShell>
  );
}
