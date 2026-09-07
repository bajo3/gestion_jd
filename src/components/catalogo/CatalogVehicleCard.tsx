import { CarFront, MessageCircle } from "lucide-react";
import { formatPrice, priceListItemTags, priceListItemTitle } from "@/lib/priceList";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { PriceListItem } from "@/types/priceList";

type CatalogVehicleCardProps = {
  item: PriceListItem;
  whatsappPhone: string;
};

export function CatalogVehicleCard({ item, whatsappPhone }: CatalogVehicleCardProps) {
  const title = priceListItemTitle(item);
  const tags = priceListItemTags(item);
  const hasCashDiscount = item.cashPrice !== null && item.cashPrice !== item.listPrice;

  const whatsappUrl = whatsappPhone
    ? buildWhatsAppUrl(
        whatsappPhone,
        `Hola! Me interesa el ${item.brand} ${title}${item.yearLabel ? ` (${item.yearLabel})` : ""}. Lo vi en el catalogo.`,
      )
    : "";

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {item.photoUrl ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
          <img
            src={item.photoUrl}
            alt={`${item.brand} ${title}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
            {item.brand}
          </span>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          {item.photoUrl ? null : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
              <CarFront className="h-3.5 w-3.5" />
              {item.brand}
            </span>
          )}
          <h3 className="text-lg font-bold leading-tight text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">
            {[item.yearLabel, item.kmLabel].filter(Boolean).join(" - ") || "Consultanos por disponibilidad"}
          </p>
        </div>

        {tags.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium capitalize text-slate-600"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto space-y-1 border-t border-slate-100 pt-3">
          <p className="text-xl font-black tracking-tight text-slate-950">
            {formatPrice(item.listPrice ?? item.cashPrice, item.currency)}
          </p>
          {hasCashDiscount ? (
            <p className="text-sm font-semibold text-emerald-600">
              Contado {formatPrice(item.cashPrice, item.currency)}
            </p>
          ) : null}
        </div>

        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff0a8a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e00879]"
          >
            <MessageCircle className="h-4 w-4" />
            Consultar por WhatsApp
          </a>
        ) : null}
      </div>
    </article>
  );
}
