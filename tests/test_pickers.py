"""Pure scoring checks for tools/pickers.py (toy data, no node)."""
from tools import pickers as P


def cand(tests=None, probes=None, tsc=0, missing=(), smoke=True, err=0, unh=0):
    return {"tests": tests or {}, "probes": probes or {}, "tsc": tsc, "missing": list(missing),
            "smoke": {"ok": smoke}, "counts": {"err": err, "warn": 0, "unhandled": unh}}


def ok(v):
    return {"ok": True, "value": v}


BAD = {"ok": False, "error": "TypeError"}


def test_selftest_ignores_zero_tests_and_tiebreaks_on_tsc():
    cs = [cand({"t1": True, "t2": False, "t3": False}), cand({"t1": True, "t2": True, "t3": False}, tsc=2),
          cand({"t1": False, "t2": True, "t3": False})]
    assert P.pick_selftest(cs) == (1, False)
    cs[1]["tests"]["t3"] = False
    cs[0]["tests"]["t2"] = True            # 0 and 1 now tie at 2; fewer tsc errors wins
    assert P.pick_selftest(cs) == (0, True)


def test_codet_prefers_big_agreeing_cluster():
    same = {"a": True, "b": True, "c": False}
    cs = [cand({"a": True, "b": True, "c": True}),   # alone: 1 * 3
          cand(same), cand(same), cand(same)]       # cluster of 3 passing 2: 6
    assert P.codet_scores(cs) == [3, 6, 6, 6]
    assert P.pick_codet(cs) == (1, True)


def test_codet_all_fail_falls_to_tiebreak():
    cs = [cand({"a": False}, tsc=1), cand({"a": False}, tsc=0)]
    assert P.pick_codet(cs) == (1, True)


def test_mbr_agreement_beats_crashing_and_lone_answers():
    cs = [cand(probes={"p": ok("1"), "q": ok("x")}), cand(probes={"p": ok("1"), "q": ok("x")}),
          cand(probes={"p": ok("2"), "q": BAD}), cand(probes={"p": BAD, "q": BAD})]
    sc = P.mbr_scores(cs)
    assert sc[0] == (True, 2, 0) and sc[2] == (True, 0, 1)
    assert sc[3] == (False, 0, 1)              # all-error candidate ranks last despite matching an error
    assert P.pick_mbr(cs) == (0, True)


def test_mbr_no_probes_ties_everyone():
    cs = [cand(tsc=1), cand(tsc=0), cand(tsc=0)]
    assert P.pick_mbr(cs) == (1, True)


def test_filter_drops_bad_and_keeps_all_if_none_survive():
    cs = [cand(tsc=1), cand(missing=["f"]), cand(smoke=False), cand()]
    assert P.filter_survivors(cs) == [3]
    assert P.pick_filter(cs) == (3, False)
    assert P.filter_survivors([cand(tsc=1), cand(tsc=2)]) == [0, 1]


def test_filter_plus_picker_maps_back_to_original_index():
    cs = [cand({"a": True, "b": True}, tsc=1), cand({"a": True}), cand({"a": False})]
    assert P.pick_selftest(cs)[0] == 0
    assert P.with_filter(P.pick_selftest)(cs) == (1, False)
