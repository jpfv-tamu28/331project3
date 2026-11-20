import { Api } from '../api';
import { useResource } from '../components/useResource';

/** The Pokemon matching an order number; renders nothing while loading or if PokeAPI is down. */
export default function OrderBuddy({ orderId }) {
  const { data } = useResource(() => Api.pokemon(orderId), [orderId]);
  if (!data) return null;
  return (
    <figure className="kiosk-buddy">
      <img src={data.sprite} alt="" width="120" height="120" />
      <figcaption>
        Your order buddy: <strong>#{String(data.dex).padStart(3, '0')} {data.name.replaceAll('-', ' ')}</strong>
        <span>{data.types.join(' / ')}</span>
      </figcaption>
    </figure>
  );
}
