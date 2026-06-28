import { createTestRunner, assert } from "../../ipc/testSupport/MockCoreServer";
import {
  appendPoint,
  buildOrthogonalPath,
  normalizeOrthogonalPath,
  orthogonalSegmentPoints,
  samePoint,
  snapCoordinate,
  snapToWireGrid,
} from "./wireGeometry";

(async () => {
  const { test, finish } = createTestRunner("wireGeometry — testes puros");

  await test("samePoint considera tolerância < 0.5", () => {
    assert(samePoint({ x: 10, y: 10 }, { x: 10.4, y: 9.6 }) === true, "deveria considerar igual dentro da tolerância");
    assert(samePoint({ x: 10, y: 10 }, { x: 10.6, y: 10 }) === false, "fora da tolerância não é igual");
  });

  await test("snapToWireGrid arredonda pro grid mais próximo", () => {
    const snapped = snapToWireGrid({ x: 10, y: 13 }, 24);
    assert(snapped.x === 0 && snapped.y === 24, `esperado {0,24}, recebido {${snapped.x},${snapped.y}}`);
  });

  await test("snapCoordinate arredonda escalar pro step dado", () => {
    assert(snapCoordinate(13, 24) === 24, "13 deveria arredondar pra 24");
    assert(snapCoordinate(11, 24) === 0, "11 deveria arredondar pra 0");
  });

  await test("appendPoint não duplica ponto igual ao último", () => {
    const points = [{ x: 0, y: 0 }];
    appendPoint(points, { x: 0.2, y: 0.1 });
    assert(points.length === 1, "ponto quase idêntico não deveria ser adicionado");
    appendPoint(points, { x: 50, y: 50 });
    assert(points.length === 2, "ponto diferente deveria ser adicionado");
  });

  await test("orthogonalSegmentPoints: pontos iguais devolve 1 ponto", () => {
    const result = orthogonalSegmentPoints({ x: 5, y: 5 }, { x: 5, y: 5 });
    assert(result.length === 1, "pontos iguais deveria devolver array de 1");
  });

  await test("orthogonalSegmentPoints: já alinhado (reta) não cria cotovelo", () => {
    const horizontal = orthogonalSegmentPoints({ x: 0, y: 0 }, { x: 100, y: 0 });
    assert(horizontal.length === 2, "segmento horizontal reto não deveria ter cotovelo");
    const vertical = orthogonalSegmentPoints({ x: 0, y: 0 }, { x: 0, y: 100 });
    assert(vertical.length === 2, "segmento vertical reto não deveria ter cotovelo");
  });

  await test("orthogonalSegmentPoints: diagonal cria um cotovelo em L", () => {
    const result = orthogonalSegmentPoints({ x: 0, y: 0 }, { x: 100, y: 50 });
    assert(result.length === 3, "diagonal deveria gerar 3 pontos (com cotovelo)");
    const elbow = result[1]!;
    assert(
      (elbow.x === 100 && elbow.y === 0) || (elbow.x === 0 && elbow.y === 50),
      "cotovelo deveria estar alinhado com o eixo dominante"
    );
  });

  await test("buildOrthogonalPath concatena segmentos sem duplicar pontos de junção", () => {
    const path = buildOrthogonalPath([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }]);
    assert(path.length === 3, `esperado 3 pontos, recebido ${path.length}`);
    assert(samePoint(path[0]!, { x: 0, y: 0 }), "primeiro ponto preservado");
    assert(samePoint(path[2]!, { x: 50, y: 50 }), "último ponto preservado");
  });

  await test("normalizeOrthogonalPath remove ponto intermediário colinear numa reta pura", () => {
    const normalized = normalizeOrthogonalPath([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]);
    assert(normalized.length === 2, `reta pura deveria colapsar pra 2 extremos, recebido ${normalized.length}`);
  });

  await test("normalizeOrthogonalPath remove ponto colinear mas preserva o cotovelo real num L", () => {
    const normalized = normalizeOrthogonalPath([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]);
    assert(normalized.length === 3, `L deveria manter o cotovelo em (100,0), recebido ${normalized.length}`);
  });

  await test("normalizeOrthogonalPath preserva cotovelo real (mudança de direção)", () => {
    const normalized = normalizeOrthogonalPath([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }]);
    assert(normalized.length === 3, "cotovelo real não deveria ser removido");
  });

  const { failed } = finish();
  process.exitCode = failed > 0 ? 1 : 0;
})();
