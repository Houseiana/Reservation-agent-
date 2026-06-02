export function PropertyDetailSkeleton() {
  return (
    <>
      <div className="pd-skel hero" />
      <div className="pd-section">
        <div className="pd-skel line medium" />
        <div className="pd-skel line short" />
        <div className="pd-skel line long" style={{ marginTop: 14 }} />
      </div>
      <div className="pd-section">
        <div className="pd-skel line long" />
        <div className="pd-skel line long" />
        <div className="pd-skel line medium" />
      </div>
      <div className="pd-section">
        <div className="pd-skel line short" />
        <div className="pd-skel line medium" />
      </div>
    </>
  );
}
