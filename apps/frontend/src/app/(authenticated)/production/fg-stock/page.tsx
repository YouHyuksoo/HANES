"use client";

import WipStockView from "../wip-stock/WipStockView";

export default function FgStockPage() {
  return (
    <WipStockView
      itemType="FINISHED"
      titleKey="production.wipStock.fgTitle"
      descriptionKey="production.wipStock.fgDescription"
    />
  );
}
