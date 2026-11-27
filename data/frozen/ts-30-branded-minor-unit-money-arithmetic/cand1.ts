export type Money<C extends string> = Readonly<{ minorUnits: number; currency: C }>;

export function money<C extends string>(minorUnits: number, currency: C): Money<C> {
    if (!Number.isInteger(minorUnits) || minorUnits < 0) {
        throw new RangeError("Minor units must be a non-negative integer");
    }
    return { minorUnits, currency } as Money<C>;
}

export function addMoney<C extends string>(a: Money<C>, b: Money<C>): Money<C> {
    if (a.currency !== b.currency) {
        throw new Error("Cannot add money of different currencies");
    }
    return money(a.minorUnits + b.minorUnits, a.currency);
}

export function allocateMoney<C extends string>(total: Money<C>, ratios: readonly number[]): Money<C>[] {
    const totalMinorUnits = total.minorUnits;
    const sumOfRatios = ratios.reduce((acc, ratio) => acc + ratio, 0);
    if (sumOfRatios <= 0) {
        throw new RangeError("Ratios must be non-zero and positive");
    }

    const shares = ratios.map((ratio, index) => {
        const baseShare = Math.floor(totalMinorUnits * ratio / sumOfRatios);
        return { baseShare, index, remainder: totalMinorUnits * ratio % sumOfRatios };
    });

    shares.sort((a, b) => b.remainder - a.remainder);

    const result: Money<C>[] = [];
    let remainingMinorUnits = totalMinorUnits;
    for (const { baseShare, index } of shares) {
        const share = money(baseShare + (remainingMinorUnits > 0 ? 1 : 0), total.currency);
        result.push(share);
        remainingMinorUnits -= share.minorUnits;
    }

    return result;
}
