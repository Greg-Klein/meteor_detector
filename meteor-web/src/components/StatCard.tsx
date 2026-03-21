// components/StatCard.tsx
import styles from "./StatCard.module.css";

interface Props {
  label: string;
  value: string | number;
  color?: "accent" | "green" | "orange" | "default";
  sub?: string;
}

export default function StatCard({ label, value, color = "default", sub }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.bar} data-color={color} />
      <div className={styles.label}>{label}</div>
      <div className={styles.value} data-color={color}>
        {value}
      </div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  );
}
