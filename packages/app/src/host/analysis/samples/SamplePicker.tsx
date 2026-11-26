"use client";

import { Button, Card } from "@ductura/ui";
import { useState } from "react";

import type { Dataset } from "../dataset/infer-kinds";
import { parseDataset } from "../dataset/parse-csv";
import { sampleMessages as t } from "./messages.hr";
import { SAMPLES } from "./samples";

/**
 * "Učitaj primjer": loads one of the invented sets without a file. The text goes through the same reader as a chosen
 * file, so a sample is held to the same limits; nothing is sent anywhere. The parent gets the set through `onLoaded`.
 */
export function SamplePicker({ onLoaded }: { onLoaded: (dataset: Dataset, sampleId: string) => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <section aria-labelledby="primjeri-naslov">
      <h2 id="primjeri-naslov">{t.title}</h2>
      <p>{t.lead}</p>
      <ul>
        {SAMPLES.map((sample) => {
          const parsed = parseDataset(sample.csv);
          return (
            <li key={sample.id}>
              <Card title={sample.title}>
                <p>{sample.description}</p>
                {parsed.ok && (
                  <p>{t.rowsColumns.replace("{rows}", String(parsed.dataset.rows.length)).replace("{columns}", String(parsed.dataset.columns.length))}</p>
                )}
                <Button
                  aria-label={`${t.load}: ${sample.title}`}
                  onClick={() => {
                    const again = parseDataset(sample.csv);
                    if (!again.ok) { setFailed(true); return; }
                    setFailed(false);
                    onLoaded(again.dataset, sample.id);
                  }}
                >
                  {t.load}
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>
      {failed && <p role="alert">{t.failed}</p>}
    </section>
  );
}
