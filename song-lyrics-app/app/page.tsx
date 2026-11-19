import SongApp from "@/components/SongApp";

export default function Home() {
  return (
    <main className="wrap">
      <div className="header">
        <h1>סדר הופעה</h1>
        <p>
          הדביקו לינק לעמוד של מילות שיר. ה-AI ישלוף את המילים ואת הפזמון, ותוכלו
          לסדר את ההופעה בגרירה.
        </p>
      </div>
      <SongApp />
    </main>
  );
}
