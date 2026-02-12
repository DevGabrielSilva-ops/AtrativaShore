const modais = [
  { abre: "abreDesconto", fecha: "fechaDesconto", modal: "Desconto-mod" },
  { abre: "abreTroca", fecha: "fechaTroca", modal: "Troca" },
];

modais.forEach(({ abre, fecha, modal }) => {
  const btnAbre = document.getElementById(abre);
  const btnFecha = document.getElementById(fecha);
  const modalEl = document.getElementById(modal);

  if (btnAbre && btnFecha && modalEl) {
    btnAbre.onclick = () => (modalEl.style.display = "flex");
    btnFecha.onclick = () => (modalEl.style.display = "none");
  }
});



//DECLARANDO MODAIS
const Pagamento = document.getElementById("Pagamento");
const SelectClient = document.getElementById("SelectClient");


//DECLARANDO AS FUNÇÕES
function abrePagamento(){
  Pagamento.style.display ="Flex";
}

function abreSelectClient(){
  Pagamento.style.display = "none";
  SelectClient.style.display ="Flex";
}

function fechaPagamento(){
    Pagamento.style.display = "none";
}

function fechaSelectClient(){
    SelectClient.style.display ="none";
    Pagamento.style.display = "Flex";
}

//PEGANDO OS ELEMENTOS PARA EXECUTAR AS FUNÇÕES
document.getElementById("abrePagamento").onclick = abrePagamento;
document.getElementById("fechaPagamento").onclick = fechaPagamento;

document.getElementById("abreSelectClient").onclick = abreSelectClient;
document.getElementById("fechaSelectClient").onclick = fechaSelectClient;



