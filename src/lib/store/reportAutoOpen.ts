// When the weekly report opens by itself: only when the user's own change in this tab turns the week
// complete, its report was not shown before (reportShownCycleIds), and the data was not just replaced
// as a whole (restored from a backup, or adopted from another tab). Never on page load: the caller starts
// `wasComplete` from the loaded data.
export const shouldAutoOpenReport = ({
  wasComplete,
  isComplete,
  alreadyShown,
  dataReplaced,
}: {
  wasComplete: boolean;
  isComplete: boolean;
  alreadyShown: boolean;
  dataReplaced: boolean;
}): boolean => isComplete && !wasComplete && !alreadyShown && !dataReplaced;
