import { describe, expect, it } from "vitest";
import { stageLoad, stageLoads, stageSequence, suggestedStages } from "./capacity";
import { label, subtask, task } from "./test-fixtures";

const jahit = label("Jahit");
const sablon = label("Sablon");
const packing = label("Packing");

describe("stageLoad", () => {
  it("counts an order once even with two subtasks at the same stage", () => {
    const order = task({
      total: 100,
      subtasks: [subtask({ labels: [jahit] }), subtask({ labels: [jahit] })],
    });
    expect(stageLoad([order], jahit).kaos).toBe(100);
  });

  it("uses the stage's own subtask due date, not the order's", () => {
    const order = task({
      total: 125,
      due_date: "2026-09-11",
      subtasks: [
        subtask({ labels: [sablon], due_date: "2026-09-11" }),
        subtask({ labels: [jahit], due_date: "2026-09-13" }),
        subtask({ labels: [packing], due_date: "2026-09-14" }),
      ],
    });
    expect(stageLoad([order], jahit).soonestDue).toBe("2026-09-13");
    expect(stageLoad([order], packing).soonestDue).toBe("2026-09-14");
  });

  it("ignores stages already finished", () => {
    const order = task({ total: 50, subtasks: [subtask({ labels: [jahit], done: true })] });
    expect(stageLoads([order])).toEqual([]);
  });
});

describe("suggestedStages", () => {
  const kemeja = label("KEMEJA");
  const jersey = label("JERSEY");
  const cetak = label("CETAK PRESS");
  const pastKemeja = task({ labels: [kemeja], subtasks: [subtask({ labels: [jahit] }), subtask({ labels: [packing] })] });
  const pastJersey = task({ labels: [jersey], subtasks: [subtask({ labels: [cetak] })] });
  const all = [pastKemeja, pastJersey];

  it("offers only stages other orders of the same product used", () => {
    const order = task({ labels: [kemeja] });
    const result = suggestedStages([...all, order], order, stageSequence(all));
    expect(result.map((l) => l.name).sort()).toEqual(["Jahit", "Packing"]);
  });

  it("offers nothing when the product has no history", () => {
    const order = task({ labels: [label("Jaket")] });
    expect(suggestedStages([...all, order], order, stageSequence(all))).toEqual([]);
  });
});

describe("stageSequence", () => {
  it("orders stages by where they usually sit in an order", () => {
    const a = task({
      subtasks: [subtask({ labels: [sablon] }), subtask({ labels: [jahit] }), subtask({ labels: [packing] })],
    });
    const b = task({ subtasks: [subtask({ labels: [sablon] }), subtask({ labels: [packing] })] });
    expect(stageSequence([a, b]).map((l) => l.name)).toEqual(["Sablon", "Jahit", "Packing"]);
  });
});
