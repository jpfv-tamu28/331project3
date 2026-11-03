/** Uppercase title on the left, muted note on the right (DenseList.sectionBar). */
export function SectionBar({ title, note, as: Heading = 'h3' }) {
  return (
    <div className="section-bar">
      <Heading>{title}</Heading>
      {note && <span>{note}</span>}
    </div>
  );
}
