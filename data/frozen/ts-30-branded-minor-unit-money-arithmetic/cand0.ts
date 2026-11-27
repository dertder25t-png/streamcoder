type Money<C extends string> = Readonly<{ minorUnits: number; currency: C }>;

function money<C extends string>(minorUnits: number, currency: C): Money<C> {
    if (!Number.isInteger(minorUnits)) {
        throw new RangeError("minorUnits must be an integer");
    }
    return { minorUnits, currency };
}

function addMoney<C extends string>(a: Money<C>, b: Money<C>): Money<C> {
    if (a.currency !== b.currency) {
        throw new Error("Cannot add Money of different currencies");
    }
    return money(a.minorUnits + b.minorUnits, a.currency);
}

function allocateMoney<C extends string>(total: Money<C>, ratios: readonly number[]): Money<C>[] {
    const sumOfRatios = ratios.reduce((acc, ratio) => acc + ratio, 0);
    if (sumOfRatios <= 0 || ratios.some(ratio => ratio < 0)) {
        throw new RangeError("Ratios must be positive and non-zero");
    }

    const totalMinorUnits = total.minorUnits;
    const baseShare = Math.floor(totalMinorUnits * 100 / sumOfRatios);
    const shares = ratios.map(ratio => Math.floor(baseShare * ratio / 100));

    let remainingMinorUnits = totalMinorUnits - shares.reduce((acc, share) => acc + share, 0);
    let i = 0;
    while (remainingMinorUnits > 0) {
        shares[i++] += 1;
        remainingMinorUnits -= 1;
    }

    return shares.map((share, index) => money(share, total.currency));
}

export { Money, money, addMoney, allocateMoney };
