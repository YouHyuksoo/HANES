"use client";

import WipStockView from "./WipStockView";

export default function WipStockPage() {
  return (
    <WipStockView
      itemType="SEMI_PRODUCT"
      titleKey="production.wipStock.semiTitle"
      descriptionKey="production.wipStock.semiDescription"
    />
  );
}
