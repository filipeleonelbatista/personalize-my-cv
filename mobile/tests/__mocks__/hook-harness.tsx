// Minimal renderHook harness on react-test-renderer (pure JS, no native).
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { ReactElement } from "react";

export { act };

export function renderHookForTest<TProps extends object, TResult>(
  cb: (props: TProps) => TResult,
  options?: { initialProps: TProps },
) {
  const box: { current: TResult } = {} as { current: TResult };
  function Probe(props: TProps): ReactElement | null {
    box.current = cb(props);
    return null;
  }
  let root: ReactTestRenderer | undefined;
  const render = (props: TProps) => {
    if (!root) {
      act(() => {
        root = create(<Probe {...props} />);
      });
    } else {
      act(() => {
        root!.update(<Probe {...props} />);
      });
    }
  };
  render((options?.initialProps ?? {}) as TProps);
  return {
    result: box,
    rerender: (props: TProps) => render(props),
  };
}
