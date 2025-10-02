import { Card } from "@/components/ui/card";
import { FileText, TrendingUp } from "lucide-react";

export const NarrativeSummaries = () => {
  return (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <FileText className="h-5 w-5" />
        AI Narrative Summaries
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h4 className="font-bold text-success">Gripen</h4>
          <div className="prose prose-sm prose-invert max-w-none">
            <p className="text-sm text-foreground leading-relaxed">
              Recent coverage highlights the Gripen's emphasis on <strong>industrial partnerships</strong> and 
              <strong> technology transfer</strong>. Portuguese media outlets are actively discussing Saab's 
              proposals for local assembly facilities and MRO capabilities. The narrative emphasizes sovereignty, 
              cost-effectiveness, and alignment with European defense initiatives. Commentary from defense analysts 
              suggests growing interest in the aircraft's <strong>operational flexibility</strong> and lower lifecycle costs.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Based on 47 sources • Updated 3 min ago</span>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-bold text-destructive">F-35</h4>
          <div className="prose prose-sm prose-invert max-w-none">
            <p className="text-sm text-foreground leading-relaxed">
              F-35 discussions center on <strong>NATO interoperability</strong> and strategic alignment with 
              the United States. Recent government statements hint at renewed interest in fifth-generation 
              capabilities. Media coverage highlights potential US support packages and joint training programs. 
              However, concerns about <strong>cost overruns</strong> and dependency on American supply chains 
              remain prominent in political commentary. The US Embassy has increased engagement on defense cooperation.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Based on 52 sources • Updated 2 min ago</span>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-bold">Overall Race</h4>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-secondary/50">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-lg">🔥</span>
                <div>
                  <div className="font-semibold text-sm">Budget Debate Intensifies</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Parliamentary committees are debating defense spending allocations. Opposition parties 
                    calling for transparency in the procurement process.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-lg">📊</span>
                <div>
                  <div className="font-semibold text-sm">Industry Partnerships Key Factor</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Both manufacturers emphasizing job creation and technology transfer. Discussions around 
                    establishing Portuguese aerospace capabilities gaining traction.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-lg">🌍</span>
                <div>
                  <div className="font-semibold text-sm">Geopolitical Considerations</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    European sovereignty vs NATO alignment debate shaping public discourse. Ukraine conflict 
                    influencing urgency of decision.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
