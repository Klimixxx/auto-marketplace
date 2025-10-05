// frontend/components/useTypingPlaceholder.js
import { useEffect, useRef } from 'react';

/**
 * Анимирует placeholder у <input>, пока пользователь не начал ввод.
 * Останавливается при focus/вводе и восстанавливает обычный placeholder.
 *
 * @param {React.RefObject<HTMLInputElement>} inputRef
 * @param {string[]} queries — варианты подсказок
 * @param {{
 *   typeSpeed?: number,              // скорость печати (мс/символ)
 *   deleteSpeed?: number,            // скорость удаления (мс/символ)
 *   holdAfterTypeMs?: number,        // пауза после допечатки перед удалением
 *   delayBetweenQueriesMs?: number,  // пауза перед СЛЕДУЮЩЕЙ подсказкой
 *   idlePlaceholder?: string,        // базовый плейсхолдер (когда всё остановлено)
 * }} opts
 */
export default function useTypingPlaceholder(
  inputRef,
  queries,
  opts = {}
) {
  const {
    typeSpeed = 55,
    deleteSpeed = 25,
    holdAfterTypeMs = 1200,
    delayBetweenQueriesMs = 30000, // 30 сек, как просил
    idlePlaceholder = 'Марка, модель, или VIN…',
  } = opts;

  const stopRef = useRef(false);
  const timers = useRef([]);
  const idxRef = useRef(0);
  const initialPH = useRef(null);

  useEffect(() => {
    const input = inputRef?.current;
    if (!input) return;

    // сохраняем изначальный placeholder
    if (initialPH.current == null) initialPH.current = input.placeholder || idlePlaceholder;
    input.placeholder = idlePlaceholder;

    const clearTimers = () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };

    const stopAll = () => {
      stopRef.current = true;
      clearTimers();
      input.placeholder = idlePlaceholder;
    };

    const isUserBusy = () => {
      // Если пользователь сфокусировался или начал что-то вводить — останавливаем анимацию
      if (document.activeElement === input) return true;
      if (input.value && input.value.length > 0) return true;
      return false;
    };

    const typeText = (text) =>
      new Promise((resolve) => {
        let i = 0;
        const tick = () => {
          if (stopRef.current || isUserBusy()) return resolve('stopped');
          input.placeholder = text.slice(0, i + 1);
          i++;
          if (i >= text.length) {
            timers.current.push(setTimeout(() => resolve('done'), holdAfterTypeMs));
          } else {
            timers.current.push(setTimeout(tick, typeSpeed));
          }
        };
        tick();
      });

    const deleteText = () =>
      new Promise((resolve) => {
        const run = () => {
          if (stopRef.current || isUserBusy()) return resolve('stopped');
          const cur = input.placeholder || '';
          if (cur.length === 0) return resolve('done');
          input.placeholder = cur.slice(0, -1);
          timers.current.push(setTimeout(run, deleteSpeed));
        };
        run();
      });

    const loop = async () => {
      stopRef.current = false;

      while (!stopRef.current) {
        const list = Array.isArray(queries) && queries.length ? queries : [idlePlaceholder];
        const q = list[idxRef.current % list.length];

        const typed = await typeText(q);
        if (typed === 'stopped') break;

        const deleted = await deleteText();
        if (deleted === 'stopped') break;

        idxRef.current++;
        // Пауза перед следующим вариантом
        let elapsed = 0;
        const step = 200;
        while (elapsed < delayBetweenQueriesMs && !stopRef.current && !isUserBusy()) {
          await new Promise((r) => {
            const t = setTimeout(r, step);
            timers.current.push(t);
          });
          elapsed += step;
        }
        if (stopRef.current || isUserBusy()) break;
      }
    };

    // Слушатели: любой фокус/ввод останавливает анимацию
    const onFocus = () => stopAll();
    const onInput = () => stopAll();
    input.addEventListener('focus', onFocus, { passive: true });
    input.addEventListener('input', onInput, { passive: true });

    // Запуск
    loop();

    return () => {
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('input', onInput);
      clearTimers();
      stopRef.current = true;
      input.placeholder = initialPH.current ?? idlePlaceholder;
    };
  }, [inputRef, JSON.stringify(queries)]);
}
