
import { fitness } from "./fitness";
import { TransportType, Slowbro, makeId, generateQR } from 'slowbro';


const content = document.getElementById("content")! as HTMLDivElement;

const addPlayerLink = async (id: string) => {
  const qr = await generateQR(id);
  const div = document.createElement("div");
  div.innerHTML = qr;
  div.style.width = "300px";
  div.style.height = "300px";
  div.style.margin = '100px';
  content.appendChild(div);
}

async function run() {
  const isTwoPlayers = window.location.search.includes('two_players');
  const ids = [];
  const id = localStorage.getItem("_id") || makeId(10);
  localStorage.setItem("_id", id);
  ids.push(id);

  await addPlayerLink(id);

  if (isTwoPlayers) {
    const secID = localStorage.getItem("_sec_id") || makeId(10);
    localStorage.setItem("_sec_id", secID);
    ids.push(secID);
    await addPlayerLink(secID);
  }

  const s = document.createElement('script')
  s.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
  document.body.appendChild(s);
  console.log("waiting answer...");
  const slowbro = new Slowbro(TransportType.webrtc, "https://rocky-gorge-69260.herokuapp.com/");
  await Promise.all(ids.map(sid => slowbro.awaitLink(sid)))
  const replies = await slowbro.startCheck({
    isVertical: true,
    functions: [
      "move",
    ]
  });
  return fitness(slowbro, content, isTwoPlayers);
}
run();
