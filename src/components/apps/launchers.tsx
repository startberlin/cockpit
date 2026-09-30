import type { ComponentType } from "react";
import type { DialogAppId } from "@/lib/apps/registry";
import { BubblesDialog } from "./bubbles-dialog";
import { CanvaDialog } from "./canva-dialog";
import { NotionDialog } from "./notion-dialog";
import { SlackDialog } from "./slack-dialog";
import { TallyDialog } from "./tally-dialog";

export interface DialogLauncherProps {
  actionLabel: string;
}

/**
 * Dialogs for external apps whose launcher is `{ type: "dialog" }`.
 *
 * Kept out of the registry so the sidebar — which imports the registry directly
 * — does not pull every dialog, `MultiStepAccordion`, and three server actions
 * into its chunk on every page. Only /tools imports this module.
 *
 * Typed as `Record<DialogAppId, …>`: declaring a dialog launcher in the registry
 * without adding the component here is a compile error, not a card with a
 * missing button.
 *
 * Each dialog sets its own `data-ph-capture-attribute-service` internally.
 */
const dialogLaunchers: Record<
  DialogAppId,
  ComponentType<DialogLauncherProps>
> = {
  slack: SlackDialog,
  notion: NotionDialog,
  tally: TallyDialog,
  canva: CanvaDialog,
  bubbles: BubblesDialog,
};

export function getDialogLauncher(
  id: string,
): ComponentType<DialogLauncherProps> | undefined {
  return dialogLaunchers[id as DialogAppId];
}
