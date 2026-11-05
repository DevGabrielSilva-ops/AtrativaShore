const empresas = new Set<number>();

export const restauracoes = {
  iniciar(idEmpresa: number): void {
    empresas.add(idEmpresa);
  },
  terminar(idEmpresa: number): void {
    empresas.delete(idEmpresa);
  },
  emAndamento(idEmpresa: number): boolean {
    return empresas.has(idEmpresa);
  },
};
