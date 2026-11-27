type Money<C extends string> = Readonly<{ minorUnits: number; currency: C }>;

function money(minorUnits: number, currency: string): Money<C> {
    if (!Number.isInteger(minorUnits)) {
        throw new RangeError("minorUnits must be an integer");
    }
    return { minorUnits, currency } as Money<C>;
}

function addMoney<C extends string>(a: Money<C>, b: Money<C>): Money<C> {
    if (a.currency !== b.currency) {
        throw new Error("Currencies must match");
    }
    return money(a.minorUnits + b.minorUnits, a.currency);
}

function allocateMoney<C extends string>(total: Money<C>, ratios: readonly number[]): Money<C>[] {
    if (ratios.some(ratio => ratio <= 0)) {
        throw new RangeError("Ratios must be positive");
    }
    const totalMinorUnits = total.minorUnits;
    const sumOfRatios = ratios.reduce((acc, ratio) => acc + ratio, 0);
    const baseShare = Math.floor(totalMinorUnits * 100 / sumOfRatios);
    const remainder = totalMinorUnits * 100 % sumOfRatios;
    const shares = ratios.map((ratio, index) => {
        const share = baseShare * ratio + (index < remainder ? 1 : 0);
        return money(share / 100, total.currency);
    });
    if (shares.reduce((acc, share) => acc + share.minorUnits, 0) !== totalMinorUnits) {
        throw new Error("Penny loss in allocation");
    }
    return shares;
}
